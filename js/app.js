var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Number.prototype.pad = function (size) {
    let s = String(this);
    while (s.length < (size || 2)) {
        s = "0" + s;
    }
    return s;
};
class App {
    constructor() {
        this._isGalleryInitialized = false;
        this._isComparisonInitialized = false;
        this._current = 0;
        this._showVanilla = true;
        this._images = this.GenerateCompareImages();
        this._container = document.querySelector(".main-content");
        this._loadingScreen = document.querySelector(".loading-screen");
        this._headerTitle = document.querySelector("body header h1");
        this._headerSubtitle = document.querySelector("body>header>p");
        this.SetEvents();
    }
    GenerateCompareImages() {
        const es = 11;
        const ss = 22;
        const images = [];
        for (let i = 1; i < es + 1; i++) {
            const image = new CompareImage("es." + i.pad(2));
            images.push(image);
        }
        for (let i = 1; i < ss + 1; i++) {
            const image = new CompareImage("ss." + i.pad(2));
            images.push(image);
        }
        return images;
    }
    SetEvents() {
        const onePageNav = this;
        window.onhashchange = function (event) {
            onePageNav.Render(decodeURI(window.location.hash));
        };
        document.addEventListener("DOMContentLoaded", (event) => {
            window.dispatchEvent(new Event('hashchange'));
        });
    }
    PreloadThumnails(index = 0) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._images.length > index) {
                yield this.PreloadImage(this._images[index].Thumb);
                return this.PreloadThumnails(index + 1);
            }
            else {
                return Promise.resolve();
            }
        });
    }
    PreloadImage(image) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                const temp = new Image();
                temp.onload = (event) => {
                    resolve();
                };
                temp.onerror = (event) => {
                    reject(event.message);
                };
                temp.src = image;
            });
        });
    }
    PreloadAdjacentImages(index) {
        return __awaiter(this, void 0, void 0, function* () {
            const next = this.GetImageIndex(this._current + 1);
            const prev = this.GetImageIndex(this._current - 1);
            yield Promise.all([
                this.PreloadImage(this._images[next].Current),
                this.PreloadImage(this._showVanilla ? this._images[next].Vanilla : this._images[next].Old),
                this.PreloadImage(this._images[prev].Current),
                this.PreloadImage(this._showVanilla ? this._images[prev].Vanilla : this._images[prev].Old)
            ]);
        });
    }
    GetImageIndex(index) {
        if (index > this._images.length - 1) {
            index = 0;
        }
        if (index < 0) {
            index = this._images.length - 1;
        }
        return index;
    }
    ShowLoadingScreen() {
        this.Show(this._loadingScreen);
    }
    HideLoadingScreen() {
        this.Hide(this._loadingScreen);
    }
    Show(element) {
        element.classList.add("visible");
    }
    Hide(element) {
        element.classList.remove("visible");
    }
    Render(url) {
        this.ShowLoadingScreen();
        const temp = url.split('/')[0];
        document.querySelectorAll(".main-content .page").forEach(element => {
            this.Hide(element);
        });
        switch (temp) {
            case "":
                this.RenderGallery();
                break;
            case "#compare":
                const index = Number(url.split('#compare/')[1].trim());
                if (index >= this._images.length || index < 0) {
                    this.RenderErrorPage();
                    return;
                }
                this.RenderComparison(index);
                break;
            default:
                this.RenderErrorPage();
                break;
        }
    }
    RenderGallery() {
        return __awaiter(this, void 0, void 0, function* () {
            const page = this._container.querySelector(".gallery.page");
            this._headerSubtitle.innerText = "Pick an image to compare vanilla, last SEC and current SEC.";
            if (!this._isGalleryInitialized) {
                this._isGalleryInitialized = true;
                const numberColumns = 4;
                const row = document.createElement("div");
                row.classList.add("row");
                for (let i = 1; i < numberColumns + 1; i++) {
                    const column = document.createElement("div");
                    column.classList.add("column");
                    row.appendChild(column);
                }
                page.appendChild(row);
                const columns = row.querySelectorAll(".column");
                yield this.PreloadThumnails(0);
                for (let i = 0; i < this._images.length; i++) {
                    const image = this._images[i];
                    const column = (i % numberColumns);
                    const element = document.createElement("img");
                    element.onclick = (event) => {
                        event.preventDefault();
                        window.location.hash = 'compare/' + i;
                    };
                    element.onload = (event) => {
                        element.removeAttribute('data-loading');
                    };
                    element.classList.add("cursor");
                    element.setAttribute("data-loading", "true");
                    element.src = image.Thumb;
                    columns[column].appendChild(element);
                }
                this.HideLoadingScreen();
                this.Show(page);
            }
            else {
                this.HideLoadingScreen();
                this.Show(page);
            }
        });
    }
    RenderComparison(index) {
        return __awaiter(this, void 0, void 0, function* () {
            this._current = index;
            const page = this._container.querySelector(".comparison.page");
            this._headerSubtitle.innerText = "Move the slider to see the diference between the two images.";
            page.querySelector(".image-index").innerText = `${index + 1}/${this._images.length}`;
            const images = this._images;
            if (!this._isComparisonInitialized) {
                this._isComparisonInitialized = true;
                page.querySelector(".close").addEventListener("click", (event) => {
                    window.location.hash = '#';
                });
                page.querySelector(".prev").addEventListener("click", (event) => {
                    goto(this._current - 1);
                });
                page.querySelector(".next").addEventListener("click", (event) => {
                    goto(this._current + 1);
                });
                function goto(id) {
                    if (id > images.length - 1) {
                        id = 0;
                    }
                    if (id < 0) {
                        id = images.length - 1;
                    }
                    window.location.hash = 'compare/' + id;
                }
                const parent = page.querySelector('.splitview');
                this._compareSlider = new CompareSlider(parent);
                page.querySelector("#vanilla-toggle").onchange = (event) => {
                    const description = page.querySelector(".splitview .top .content .description h1");
                    if (event.target.checked) {
                        description.innerText = "Vanilla";
                        this._compareSlider.ResizeElement.querySelector("img").src = images[this._current].Vanilla;
                    }
                    else {
                        description.innerText = "Old";
                        this._compareSlider.ResizeElement.querySelector("img").src = images[this._current].Old;
                    }
                    this._showVanilla = event.target.checked;
                };
                const skewedToggle = page.querySelector("#skewed-toggle");
                if (this._compareSlider.Skewed) {
                    skewedToggle.checked = true;
                }
                skewedToggle.onchange = (event) => {
                    this._compareSlider.Skewed = event.target.checked;
                    const old = this._compareSlider.ResizeElement.style.width;
                    this._compareSlider.ResizeElement.style.width = `${old.split("+")[0]} + ${this._compareSlider.Skewed ? 1000 : 0}px)`;
                };
            }
            yield Promise.all([
                this.PreloadImage(images[index].Current),
                this.PreloadImage(this._showVanilla ? images[index].Vanilla : images[index].Old)
            ]);
            this._compareSlider.Container.querySelector(".bottom").querySelector("img").src = images[index].Current;
            this._compareSlider.ResizeElement.querySelector("img").src = this._showVanilla ? images[index].Vanilla : images[index].Old;
            this.HideLoadingScreen();
            this.Show(page);
            window.dispatchEvent(new Event('resize'));
            this.PreloadAdjacentImages(index);
        });
    }
    RenderErrorPage() {
        const page = document.querySelector(".main-content .error.page");
        this.HideLoadingScreen();
        this.Show(page);
    }
}
class CompareImage {
    constructor(prefix) {
        this._prefix = prefix;
    }
    get Thumb() { return `img/thumb/${this._prefix}.sec.d.jpg`; }
    get Vanilla() { return `img/${this._prefix}.vanilla.jpg`; }
    get Current() { return `img/${this._prefix}.sec.d.jpg`; }
    get Old() { return `img/${this._prefix}.sec.jpg`; }
}
const app = new App();
