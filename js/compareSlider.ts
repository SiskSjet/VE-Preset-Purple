
class CompareSlider {
    private _default = 30;
    private _container: HTMLElement;
    private _dragElement: HTMLElement;
    private _resizeElement: HTMLElement;
    private _animateInterval: number;
    public Position: number = 30;
    private _dragOffset = 0;
    private _isMoving = false;

    constructor(container: HTMLElement) {
        this._container = container;
        this._dragElement = container.querySelector(".handle");
        this._resizeElement = container.querySelector(".top");

        this._dragElement.style.left = `${this._default}%`;
        this._resizeElement.style.width = `calc(${this._default}% + ${this.Skewed ? 1000 : 0}px)`;
        this.SetEvents();
    }

    public get Container(): HTMLElement { return this._container; }
    public get ResizeElement(): HTMLElement { return this._resizeElement; }
    public get DragElement(): HTMLElement { return this._dragElement; }
    public get Skewed(): boolean {
        return this._container.classList.contains("skewed");
    }

    public set Skewed(value: boolean) {
        if (this.Skewed == value) {
            return;
        }

        if (value) {
            this._container.classList.add("skewed");
        } else {
            this._container.classList.remove("skewed");
        }
    }

    private SetEvents(): void {
        const comparison = this;
        this._container.addEventListener("click", function (event: MouseEvent & TouchEvent) {
            event.preventDefault();
            event.stopPropagation();

            if (comparison._isMoving) {
                return;
            }
            comparison.CalculatePosition(this, event);
        });

        addEventListeners(this._dragElement, ["mousedown", "touchstart"], function (event: MouseEvent & TouchEvent) {
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

            function end(event: MouseEvent & TouchEvent) {
                event.preventDefault();
                event.stopPropagation();

                comparison._dragElement.classList.remove("draggable");
                removeEventListeners(document.body, ["mousemove", "touchmove"], move);
                removeEventListeners(document.body, ["mouseup", "touchend", "touchcancel"], end);

                setTimeout(() => { comparison._isMoving = false; }, 10);
            }

            function move(event: MouseEvent & TouchEvent) {
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
        })

        this._container.querySelectorAll("img").forEach(item => {
            item.ondragstart = (event) => { event.preventDefault(); };
        });
    }

    private CalculatePosition(element: HTMLElement, event: (MouseEvent & TouchEvent)): void {
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

    private SetSliderPosition(percent: number, eventType: string): void {
        switch (eventType) {
            case "click":
                this.SetPositionAnimated(percent);
                break;
            default:
                this.UpdatePosition(percent);
        }
    }

    private SetPositionAnimated(percent: number): void {
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

    private UpdatePosition(percent: number): void {
        this.Position = percent;
        this._dragElement.style.left = percent.toFixed(2) + "%";
        this._resizeElement.style.width = `calc(${percent.toFixed(2)}% + ${this.Skewed ? 1000 : 0}px)`;
    }

    private SetSliderSize() {
        const page = this._container.parentElement;
        if (!page.classList.contains("visible")) {
            return;
        }
        const maxWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
        const maxHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

        const pageHeight = page.parentElement.offsetHeight;
        const pageOffset = page.parentElement.offsetTop;

        const reference = this._container.querySelector(".content") as HTMLElement;
        const height = reference.offsetHeight;
        const ratio = 1.777777777777778;
        const offset = pageHeight - height;

        const widthT = (maxHeight - pageOffset - offset) * ratio
        let percent = (widthT) / maxWidth * 100;

        if (percent > 100) {
            percent = 100;
        }
        this._container.style.width = percent + "%";
        this._container.querySelectorAll(".content").forEach((item: HTMLElement) => {
            item.style.width = percent + "vw";
        });
    }
}

function GetHeight(element: Element): number {
    const style = window.getComputedStyle(element, null);
    return parseFloat(style.getPropertyValue("height")) + parseFloat(style.getPropertyValue("margin-bottom"));
}

function addEventListeners(element: Element, events: string[], listener: EventListenerOrEventListenerObject) {
    for (let i = 0; i < events.length; i++) {
        element.addEventListener(events[i], listener, false);
    }
}

function removeEventListeners(element: Element, events: string[], listener: EventListenerOrEventListenerObject) {
    for (let i = 0; i < events.length; i++) {
        element.removeEventListener(events[i], listener, false);
    }
}
