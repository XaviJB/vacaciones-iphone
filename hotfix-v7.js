(function () {
  const MOVE_CANCEL_PX = 10;
  let titleTap = { id: "", time: 0 };

  installDurationControls();
  patchPrepareNewTask();
  patchTaskSubmit();
  installCardTitleEditor();
  patchCardMoveFinish();
  prepareNewTask();

  function installDurationControls() {
    const taskDuration = taskForm.querySelector(".duration-options");
    if (taskDuration && !document.querySelector("#taskDurationSelect")) {
      const options = Array.from({ length: 8 }, (_, index) => {
        const hour = index + 1;
        return `<option value="${hour}">${hour}h</option>`;
      }).join("");

      taskDuration.classList.add("duration-picker");
      taskDuration.innerHTML = `
        <legend>Duración</legend>
        <label><input type="radio" name="quickDuration" value="1" checked><span>1h</span></label>
        <label><input type="radio" name="quickDuration" value="2"><span>2h</span></label>
        <label><input type="radio" name="quickDuration" value="3"><span>3h</span></label>
        <label class="duration-more">
          <span>Más</span>
          <select id="taskDurationSelect" name="duration">${options}</select>
        </label>
      `;

      const select = document.querySelector("#taskDurationSelect");
      taskDuration.querySelectorAll('[name="quickDuration"]').forEach((radio) => {
        radio.addEventListener("change", () => {
          if (radio.checked) select.value = radio.value;
        });
      });
      select.addEventListener("change", () => {
        taskDuration.querySelectorAll('[name="quickDuration"]').forEach((radio) => {
          radio.checked = radio.value === select.value;
        });
      });
    }

    const editDuration = editForm.querySelector(".duration-options");
    if (editDuration && !editDuration.querySelector('[value="8"]')) {
      for (let hour = 5; hour <= 8; hour += 1) {
        editDuration.insertAdjacentHTML(
          "beforeend",
          `<label><input type="radio" name="editDuration" value="${hour}"><span>${hour}h</span></label>`
        );
      }
    }
  }

  function patchPrepareNewTask() {
    prepareNewTask = function () {
      taskColor.value = randomColor();
      const select = document.querySelector("#taskDurationSelect");
      if (select) select.value = "1";
      taskForm.querySelectorAll('[name="quickDuration"]').forEach((radio) => {
        radio.checked = radio.value === "1";
      });
    };
  }

  function patchTaskSubmit() {
    taskForm.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();

        const title = taskTitle.value.trim();
        if (!title) return;

        const start = Number(taskStart.value);
        const duration = Number(document.querySelector("#taskDurationSelect")?.value || 1);
        if (!fitsInDay(start, duration)) return;

        state.tasks.push({
          id: makeId(),
          title,
          date: taskDate.value,
          start,
          duration,
          color: taskColor.value
        });

        taskTitle.value = "";
        taskDialog.close();
        prepareNewTask();
        saveAndRender();
      },
      true
    );
  }

  function installCardTitleEditor() {
    calendarGrid.addEventListener("dblclick", (event) => {
      const card = event.target.closest?.(".event-title")?.closest?.(".event-card");
      if (!card?.dataset.id) return;
      event.preventDefault();
      event.stopPropagation();
      openEditor(card.dataset.id);
    });

    calendarGrid.addEventListener("click", (event) => {
      const card = event.target.closest?.(".event-title")?.closest?.(".event-card");
      if (!card?.dataset.id) return;

      const now = Date.now();
      if (titleTap.id === card.dataset.id && now - titleTap.time < 360) {
        event.preventDefault();
        event.stopPropagation();
        titleTap = { id: "", time: 0 };
        openEditor(card.dataset.id);
        return;
      }

      titleTap = { id: card.dataset.id, time: now };
    });
  }

  function patchCardMoveFinish() {
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

      render();
    };

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
  }
})();
