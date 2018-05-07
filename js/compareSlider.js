class CompareSlider {
    constructor(container) {
        this._default = 30;
        this.Position = 30;
        this._dragOffset = 0;
        this._isMoving = false;
        this._container = container;
        this._dragElement = container.querySelector(".handle");
        this._resizeElement = container.querySelector(".top");
        this._dragElement.style.left = `${this._default}%`;
        this._resizeElement.style.width = `calc(${this._default}% + ${this.Skewed ? 1000 : 0}px)`;
        this.SetEvents();
    }
    get Container() { return this._container; }
    get ResizeElement() { return this._resizeElement; }
    get DragElement() { return this._dragElement; }
    get Skewed() {
        return this._container.classList.contains("skewed");
    }
    set Skewed(value) {
        if (this.Skewed == value) {
            return;
        }
        if (value) {
            this._container.classList.add("skewed");
        }
        else {
            this._container.classList.remove("skewed");
        }
    }
    SetEvents() {
        const comparison = this;
        this._container.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            if (comparison._isMoving) {
                return;
            }
            comparison.CalculatePosition(this, event);
        });
        addEventListeners(this._dragElement, ["mousedown", "touchstart"], function (event) {
            event.preventDefault();
            event.stopPropagation();
            if (!event.pageX && !event.touches) {
                return;
            }
            const x = (event.pageX || event.touches[0].pageX);
            comparison._dragOffset = x - comparison._dragElement.offsetLeft;
            comparison._isMoving = true;
            comparison._dragElement.classList.add("draggable");
            addEventListeners(document.body, ["mouseup", "touchend", "touchcancel"], end);
            addEventListeners(document.body, ["mousemove", "touchmove"], move);
            function end(event) {
                event.preventDefault();
                event.stopPropagation();
                comparison._dragElement.classList.remove("draggable");
                removeEventListeners(document.body, ["mousemove", "touchmove"], move);
                removeEventListeners(document.body, ["mouseup", "touchend", "touchcancel"], end);
                setTimeout(() => { comparison._isMoving = false; }, 10);
            }
            function move(event) {
                event.preventDefault();
                event.stopPropagation();
                if (comparison._dragElement.classList.contains("draggable")) {
                    comparison.CalculatePosition(this, event);
                    if (document["selection"]) {
                        document["selection"].empty();
                    }
                }
            }
        });
        addEventListeners(window, ["resize", "load"], function (event) {
            comparison.SetSliderSize();
        });
        this._container.querySelectorAll("img").forEach(item => {
            item.ondragstart = (event) => { event.preventDefault(); };
        });
    }
    CalculatePosition(element, event) {
        const maxWidth = this._container.offsetWidth;
        const dragWidth = this._dragElement.offsetWidth;
        if (!event.clientX && !event.touches) {
            return;
        }
        const x = (event.clientX || event.touches[0].pageX);
        const offset = (event.type === "click" && !this._isMoving) ? 0 : this._dragOffset + dragWidth / 2;
        let position = x - offset;
        // console.log({
        //     event: event.type,
        //     isMoving: this._isMoving,
        //     offset, position, x,
        //     dragWidth,
        //     maxWidth
        // });
        let positionInPercent = position * 100 / maxWidth;
        if (positionInPercent > 100) {
            positionInPercent = 100;
        }
        else if (positionInPercent < 0) {
            positionInPercent = 0;
        }
        this.SetSliderPosition(positionInPercent, event.type);
    }
    SetSliderPosition(percent, eventType) {
        switch (eventType) {
            case "click":
                this.SetPositionAnimated(percent);
                break;
            default:
                this.UpdatePosition(percent);
        }
    }
    SetPositionAnimated(percent) {
        const comparison = this;
        let currentPosition = this.Position;
        clearInterval(comparison._animateInterval);
        if (percent == currentPosition) {
            return;
        }
        else if (currentPosition > percent) {
            decrementPosition();
        }
        else {
            incrementPosition();
        }
        // Support animate functions
        function incrementPosition() {
            comparison._animateInterval = setInterval(function () {
                currentPosition++;
                comparison.UpdatePosition(currentPosition);
                if (currentPosition >= percent) {
                    setFinalPositionAndClearInterval();
                }
            }, 10);
        }
        function decrementPosition() {
            comparison._animateInterval = setInterval(function () {
                currentPosition--;
                comparison.UpdatePosition(currentPosition);
                if (currentPosition <= percent) {
                    setFinalPositionAndClearInterval();
                }
            }, 10);
        }
        function setFinalPositionAndClearInterval() {
            comparison.UpdatePosition(percent);
            clearInterval(comparison._animateInterval);
        }
    }
    UpdatePosition(percent) {
        this.Position = percent;
        this._dragElement.style.left = percent.toFixed(2) + "%";
        this._resizeElement.style.width = `calc(${percent.toFixed(2)}% + ${this.Skewed ? 1000 : 0}px)`;
    }
    SetSliderSize() {
        const page = this._container.parentElement;
        if (!page.classList.contains("visible")) {
            return;
        }
        const maxWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
        const maxHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
        const pageHeight = page.offsetHeight;
        const reference = this._container.querySelector(".content");
        const width = reference.offsetWidth;
        const height = reference.offsetHeight;
        const ratio = width / height;
        const offset = pageHeight - height;
        const widthT = (maxHeight - offset) * ratio;
        let percent = widthT / maxWidth * 100;
        if (percent > 100) {
            percent = 100;
        }
        this._container.style.width = percent + "%";
        this._container.querySelectorAll(".content").forEach((item) => {
            item.style.width = percent + "vw";
        });
    }
}
function addEventListeners(element, events, listener) {
    for (let i = 0; i < events.length; i++) {
        element.addEventListener(events[i], listener, false);
    }
}
function removeEventListeners(element, events, listener) {
    for (let i = 0; i < events.length; i++) {
        element.removeEventListener(events[i], listener, false);
    }
}
