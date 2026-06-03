(function () {
  const LONG_PRESS_MS = 520;
  const MOVE_CANCEL_PX = 10;
  let bookingLink;
  let bookingAttachment;

  installBookingFields();
  patchBookingNormalizer();
  mergeStoredBookingDetails();
  patchBookingSubmit();
  patchBookingRender();
  renderBookings();

  function installBookingFields() {
    if (document.querySelector("#bookingLink")) {
      bookingLink = document.querySelector("#bookingLink");
      bookingAttachment = document.querySelector("#bookingAttachment");
      return;
    }

    const referenceField = bookingCode?.closest(".field");
    if (!referenceField) return;

    referenceField.insertAdjacentHTML(
      "afterend",
      `
        <label class="field">
          <span>Correo / enlace</span>
          <input id="bookingLink" type="text" placeholder="Pega el enlace del email, Drive o iCloud" maxlength="300">
        </label>
        <label class="field">
          <span>PDF o correo</span>
          <input id="bookingAttachment" type="file" accept=".pdf,.eml,.msg,image/*,application/pdf,message/rfc822">
        </label>
      `
    );

    bookingLink = document.querySelector("#bookingLink");
    bookingAttachment = document.querySelector("#bookingAttachment");
  }

  function mergeStoredBookingDetails() {
    try {
      const saved = JSON.parse(localStorage.getItem("vacation-calendar-v3"));
      if (!Array.isArray(saved?.bookings)) return;

      state.bookings = state.bookings.map((booking) => {
        const fullBooking = saved.bookings.find((item) => item.id === booking.id);
        return {
          ...booking,
          link: String(fullBooking?.link || booking.link || ""),
          attachment: fullBooking?.attachment?.data ? fullBooking.attachment : booking.attachment || null
        };
      });
    } catch {
      // Keep the current in-memory state when local storage is not readable.
    }
  }

  function patchBookingNormalizer() {
    normalizeBooking = function (booking) {
      return {
        id: booking.id || makeId(),
        title: String(booking.title || ""),
        date: String(booking.date || ""),
        time: String(booking.time || ""),
        code: String(booking.code || ""),
        link: String(booking.link || ""),
        attachment: booking.attachment?.data ? booking.attachment : null
      };
    };
  }

  function patchBookingSubmit() {
    bookingForm.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();

        const title = bookingTitle.value.trim();
        if (!title) return;

        const finish = (attachment = null) => {
          state.bookings.push({
            id: makeId(),
            title,
            date: bookingDate.value,
            time: bookingTime.value,
            code: bookingCode.value.trim(),
            link: bookingLink?.value.trim() || "",
            attachment
          });
          bookingForm.reset();
          saveAndRender();
        };

        const file = bookingAttachment?.files?.[0];
        if (!file) {
          finish();
          return;
        }

        readBookingAttachment(file).then(finish);
      },
      true
    );
  }

  function patchBookingRender() {
    renderBookings = function () {
      bookingCount.textContent = String(state.bookings.length);
      bookingList.innerHTML = "";

      [...state.bookings].sort(compareDatedItems).forEach((booking) => {
        const item = document.createElement("article");
        const hasLink = isOpenableLink(booking.link);
        const hasAttachment = Boolean(booking.attachment?.data);
        item.className = "list-item";
        item.innerHTML = `
          <header>
            <div>
              <strong>${escapeHtml(booking.title)}</strong>
              <p class="list-meta">${formatBookingMeta(booking)}</p>
            </div>
            <div class="list-actions">
              ${hasLink ? `<button class="small-button" type="button" data-open-link="${booking.id}">Correo</button>` : ""}
              ${hasAttachment ? `<button class="small-button" type="button" data-open-file="${booking.id}">PDF</button>` : ""}
              <button class="small-button" type="button" data-delete-booking="${booking.id}">Borrar</button>
            </div>
          </header>
          ${booking.code ? `<p class="list-meta">${escapeHtml(booking.code)}</p>` : ""}
          ${booking.link && !hasLink ? `<p class="list-meta">${escapeHtml(booking.link)}</p>` : ""}
          ${booking.attachment?.name ? `<p class="list-meta">Adjunto: ${escapeHtml(booking.attachment.name)}</p>` : ""}
        `;
        bookingList.appendChild(item);
      });

      $$("[data-open-link]").forEach((button) =>
        button.addEventListener("click", () => {
          const booking = state.bookings.find((item) => item.id === button.dataset.openLink);
          if (booking?.link) window.open(booking.link, "_blank", "noopener");
        })
      );

      $$("[data-open-file]").forEach((button) =>
        button.addEventListener("click", () => {
          const booking = state.bookings.find((item) => item.id === button.dataset.openFile);
          if (booking?.attachment?.data) openAttachment(booking.attachment);
        })
      );

      $$("[data-delete-booking]").forEach((button) =>
        button.addEventListener("click", () => {
          state.bookings = state.bookings.filter((booking) => booking.id !== button.dataset.deleteBooking);
          saveAndRender();
        })
      );
    };
  }

  function readBookingAttachment(file) {
    const maxSize = 2.5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert("Ese archivo es grande para guardarlo dentro del viaje. Mejor pega un enlace al correo o a iCloud/Drive.");
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        resolve({
          name: file.name,
          type: file.type || "application/octet-stream",
          data: String(reader.result)
        });
      });
      reader.addEventListener("error", () => resolve(null));
      reader.readAsDataURL(file);
    });
  }

  function isOpenableLink(value) {
    return /^(https?:|mailto:|message:)/i.test(String(value || ""));
  }

  function openAttachment(attachment) {
    const popup = window.open("", "_blank", "noopener");
    if (!popup) {
      const link = document.createElement("a");
      link.href = attachment.data;
      link.download = attachment.name || "reserva";
      link.click();
      return;
    }

    popup.document.title = attachment.name || "Reserva";
    popup.document.body.style.margin = "0";
    if (attachment.type?.startsWith("image/")) {
      popup.document.body.innerHTML = `<img src="${attachment.data}" alt="" style="max-width:100%;height:auto;display:block;margin:auto;">`;
      return;
    }

    popup.document.body.innerHTML = `<iframe src="${attachment.data}" title="Reserva" style="width:100vw;height:100vh;border:0;"></iframe>`;
  }

  startDrag = function (event, id) {
    const task = state.tasks.find((item) => item.id === id);
    if (!task || event.button > 0) return;

    const card = event.currentTarget;
    dragState = {
      id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      offsetX: 0,
      offsetY: 0,
      moved: false,
      armed: false,
      timer: window.setTimeout(() => armCardMove(card, event.pointerId), LONG_PRESS_MS)
    };

    card.classList.add("is-pressing");
    card.addEventListener("pointermove", dragCard);
    card.addEventListener("pointerup", finishDrag);
    card.addEventListener("pointercancel", cancelDrag);
  };

  function armCardMove(card, pointerId) {
    if (!dragState || dragState.pointerId !== pointerId || dragState.armed) return;

    const rect = card.getBoundingClientRect();
    dragState.armed = true;
    dragState.offsetX = dragState.lastX - rect.left;
    dragState.offsetY = dragState.lastY - rect.top;

    try {
      card.setPointerCapture?.(pointerId);
    } catch {
      // Pointer capture can be unavailable after interrupted touches.
    }

    card.classList.remove("is-pressing");
    card.classList.add("is-dragging");
    document.body.classList.add("card-edit-mode");
    card.style.width = `${rect.width}px`;
    card.style.left = `${rect.left}px`;
    card.style.right = "auto";
    card.style.top = `${rect.top}px`;
    card.style.position = "fixed";
    navigator.vibrate?.(8);
  }

  dragCard = function (event) {
    if (!dragState) return;

    const card = event.currentTarget;
    dragState.lastX = event.clientX;
    dragState.lastY = event.clientY;

    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;

    if (!dragState.armed) {
      if (Math.abs(dx) > MOVE_CANCEL_PX || Math.abs(dy) > MOVE_CANCEL_PX) cleanupDragCard(card, event.pointerId);
      return;
    }

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragState.moved = true;
    event.preventDefault();
    card.style.left = `${event.clientX - dragState.offsetX}px`;
    card.style.top = `${event.clientY - dragState.offsetY}px`;
  };

  finishDrag = function (event) {
    const card = event.currentTarget;
    const task = state.tasks.find((item) => item.id === dragState?.id);
    const wasMoved = dragState?.moved;
    const wasArmed = dragState?.armed;
    const drop = wasArmed && wasMoved ? getDropTarget(event.clientX, event.clientY, task?.duration || 1) : null;

    cleanupDragCard(card, event.pointerId);
    if (!task) return;

    if (drop) {
      task.date = drop.date;
      task.start = drop.start;
      saveAndRender();
      return;
    }

    if (wasArmed && !wasMoved) openEditor(task.id);
    else render();
  };

  cancelDrag = function (event) {
    cleanupDragCard(event.currentTarget, event.pointerId);
    render();
  };

  cleanupDragCard = function (card, pointerId) {
    if (dragState?.timer) window.clearTimeout(dragState.timer);

    try {
      card.releasePointerCapture?.(pointerId);
    } catch {
      // The card may never have captured the pointer while the user was scrolling.
    }

    card.removeEventListener("pointermove", dragCard);
    card.removeEventListener("pointerup", finishDrag);
    card.removeEventListener("pointercancel", cancelDrag);
    card.classList.remove("is-pressing", "is-dragging");
    document.body.classList.remove("card-edit-mode");
    card.style.width = "";
    card.style.left = "";
    card.style.right = "";
    card.style.top = "";
    card.style.position = "";
    dragState = null;
  };
})();
