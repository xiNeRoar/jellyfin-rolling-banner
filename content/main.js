class Home {
  static start() {
    this.bannerInterval = null;
    this.eventListenersAdded = false;
    this.refreshItem = true;
    this.cache = { items: undefined };
    this.index = 1;
    this.transitionendFlag = false;
    this.itemQuery = {
      ImageTypes: "Backdrop",
      EnableImageTypes: "Backdrop",
      IncludeItemTypes: "Movie",
      SortBy: "DateCreated, ProductionYear, PremiereDate, SortName",
      Recursive: true,
      ImageTypeLimit: 1,
      Limit: 10,
      Fields: "Overview",
      SortOrder: "Descending",
      EnableUserData: false,
      EnableTotalRecordCount: false,
    };
    this.coverOptions = { type: "Backdrop", maxWidth: 3000, adjustForPixelRatio: false };
    this.logoOptions = { type: "Logo", maxWidth: 3000, adjustForPixelRatio: false };
    this.coverType_L = "Backdrop"; // Landscape
    this.coverType_P = "Primary"; // Portrait
    this.itemQuery.ImageTypes = this.coverType_L;

    /* Monitor node loading */
    document.addEventListener(
      "viewbeforeshow",
      function (e) {
        if (e.detail.type === "home" || e.target.id === "indexPage") {
          // Determine orientation based on window dimensions
          if (innerWidth < innerHeight) {
            if (this.coverOptions.type != this.coverType_P)
              this.coverOptions.type = this.coverType_P;
          } else {
            if (this.coverOptions.type != this.coverType_L)
              this.coverOptions.type = this.coverType_L;
          }

          if (!e.detail.isRestored && !e.target.querySelector(".misty-banner")) {
            this.initLoading();
            const mutation = new MutationObserver(
              function (mutationRecords) {
                for (let mutationRecord of mutationRecords) {
                  if (mutationRecord.target.classList.contains("homeSectionsContainer")) {
                    this.init();
                    mutation.disconnect();
                    break;
                  }
                }
              }.bind(this)
            );
            mutation.observe(document.body, {
              childList: true,
              characterData: true,
              subtree: true,
            });
          } else {
            this.startCarousel(); // startCarousel handles interval management
          }
        } else {
          this.resetCarouselInterval(); // Clear interval when leaving the home page
        }
      }.bind(this)
    );

    document.addEventListener(
      "visibilitychange",
      function () {
        if (document.visibilityState === "hidden") {
          this.resetCarouselInterval(); // Clear interval when page is hidden
        } else if (location.hash === "#!/home.html") {
          this.startCarousel(); // Restart carousel when page is visible and on home page
        }
      }.bind(this)
    );

    const executeOnce = () => {
      // Determine orientation and adjust cover type
      if (innerWidth < innerHeight) {
        if (this.coverOptions.type != this.coverType_P) {
          this.coverOptions.type = this.coverType_P;
          $(".misty-banner-item").each(
            async function (index, element) {
              let src = await this.getImageUrl($(element).attr("id"), this.coverOptions);
              $(element).children("img").attr("src", src);
            }.bind(this)
          );
        }
      } else {
        if (this.coverOptions.type != this.coverType_L) {
          this.coverOptions.type = this.coverType_L;
          $(".misty-banner-item").each(
            async function (index, element) {
              let src = await this.getImageUrl($(element).attr("id"), this.coverOptions);
              $(element).children("img").attr("src", src);
            }.bind(this)
          );
        }
      }
    };
    const debounce = (fn, delay) => {
      let timer;
      return function () {
        if (timer) {
          clearTimeout(timer);
        }
        timer = setTimeout(() => {
          fn();
        }, delay);
      };
    };
    const cancelDebounce = debounce(executeOnce, 100);
    window.addEventListener("resize", cancelDebounce);

    this.refreshInterval = 1 * 60 * 1000; // 1 minute in milliseconds
    this.setupItemRefresh();
  }

  static setupItemRefresh() {
    setInterval(() => {
      this.refreshItems();
    }, this.refreshInterval);
  }

  static async refreshItems() {
    console.log("Attempting to refresh items at:", new Date().toLocaleTimeString());
    const newData = await this.getItems(this.itemQuery);
    if (JSON.stringify(newData) !== JSON.stringify(this.data)) {
      console.log("New data found, updating banner");
      this.data = newData;
      await this.updateBanner();
    } else {
      console.log("No new data found");
    }
  }

  static async updateBanner() {
    console.log("Updating banner with new items at:", new Date().toLocaleTimeString());

    // Clear existing banner items
    $(".homePage:not(.hide) .misty-banner-body").empty();
    $(".homePage:not(.hide) .misty-banner-logos").empty();

    // Re-add banner items with new data
    for (let detail of this.data.Items) {
      const itemHtml = `
        <div class="misty-banner-item" id="${detail.Id}">
          <img draggable="false" loading="eager" decoding="sync" class="misty-banner-cover" src="${await this.getImageUrl(
            detail.Id,
            this.coverOptions
          )}" alt="Backdrop" style="">
          <div class="misty-banner-info padded-left padded-right">
            <h1>${detail.Name}</h1>
            <div><p>${detail.Overview}</p></div>
            <div><button onclick="Emby.Page.showItem('${detail.Id}')">MORE</button></div>
          </div>
        </div>
      `;

      if (detail.ImageTags && detail.ImageTags.Logo) {
        const logoHtml = `
          <img id="${
            detail.Id
          }" draggable="false" loading="eager" decoding="sync" class="misty-banner-logo" data-banner="img-title" alt="Logo" src="${await this.getImageUrl(
          detail.Id,
          this.logoOptions
        )}">
        `;
        $(".homePage:not(.hide) .misty-banner-logos").append(logoHtml);
      }
      $(".homePage:not(.hide) .misty-banner-body").append(itemHtml);
    }

    // Re-add first and last items for smooth looping
    let firstitem = $(".homePage:not(.hide) .misty-banner-item").first().clone();
    let lastitem = $(".homePage:not(.hide) .misty-banner-item").last().clone();
    $(".homePage:not(.hide) .misty-banner-body").append(firstitem);
    $(".homePage:not(.hide) .misty-banner-body").prepend(lastitem);

    // Reset index and restart carousel
    this.index = 1;
    this.staticSwitchCss();
    this.startCarousel(); // startCarousel handles interval management
  }

  static async init() {
    $(".homePage:not(.hide)").attr("data-type", "home");
    await this.initBanner();
    this.addEventListeners(); // Add event listeners
  }

  /* Insert Loading */
  static initLoading() {
    const load = `
        <div class="misty-loading">
          <h1></h1>
          <div class="docspinner mdl-spinner mdlSpinnerActive">
            <!-- Spinner layers here -->
          </div>
        </div>
      `;
    $("body").append(load);
  }

  static injectCode(code) {
    let hash = md5(code + Math.random().toString());
    return new Promise((resolve, reject) => {
      if ("BroadcastChannel" in window) {
        const channel = new BroadcastChannel(hash);
        channel.addEventListener("message", (event) => resolve(event.data));
      } else if ("postMessage" in window) {
        window.addEventListener("message", (event) => {
          if (event.data.channel === hash) {
            resolve(event.data.message);
          }
        });
      }
      const script = `
          <script class="I${hash}">
            setTimeout(async ()=> {
              async function R${hash}(){${code}};
              if ("BroadcastChannel" in window) {
                const channel = new BroadcastChannel("${hash}");
                channel.postMessage(await R${hash}());
              } else if ('postMessage' in window) {
                window.parent.postMessage({channel:"${hash}",message:await R${hash}()}, "*");
              }
              document.querySelector("script.I${hash}").remove()
            }, 16)
          </script>
          `;
      $(document.head || document.documentElement).append(script);
    });
  }

  static injectCall(func, arg) {
    const script = `
        const client = await new Promise((resolve, reject) => {
          setInterval(() => {
            if (window.ApiClient != undefined) resolve(window.ApiClient);
          }, 16);
        });
        return await client.${func}(${arg})
        `;
    return this.injectCode(script);
  }

  static getItems(query) {
    this.cache.items = this.injectCall(
      "getItems",
      "client.getCurrentUserId(), " + JSON.stringify(query)
    );
    return this.cache.items;
  }

  static getImageUrl(itemId, options) {
    return this.injectCall("getImageUrl", "'" + itemId + "'" + ", " + JSON.stringify(options));
  }

  static dynamicSwitchCss() {
    // Background switch
    $(".homePage:not(.hide) .misty-banner-body").css({
      left: -(this.index * 100).toString() + "%",
      transition: "all 1.5s cubic-bezier(0.15, 0.07, 0, 1) 0s",
    });
    // Info switch
    $(".homePage:not(.hide) .misty-banner-info > *").css({ cssText: "opacity: 0 !important" });
    $(".homePage:not(.hide) .misty-banner-info > *").css({
      transition: "all 2.5s cubic-bezier(0, 1.41, 0.36, 0.93) .4s",
      transform: "translateY(150%)",
    });
    $(".homePage:not(.hide) .misty-banner-item.active .misty-banner-info > *").css({
      cssText: "opacity: 1 !important",
    });
    $(".homePage:not(.hide) .misty-banner-item.active .misty-banner-info > *").css({
      transform: "translateY(0)",
    });
    $(".homePage:not(.hide) .misty-banner-item.active").removeClass("active");
    $(".homePage:not(.hide) .misty-banner-info > *").css({ cssText: "opacity: 0 !important" });
    $(".homePage:not(.hide) .misty-banner-info > *").css({
      transition: "all 2.5s cubic-bezier(0, 1.41, 0.36, 0.93) .4s",
      transform: "translateY(150%)",
    });
    let id = $(".homePage:not(.hide) .misty-banner-item")
      .eq(this.index)
      .addClass("active")
      .attr("id");
    $(".homePage:not(.hide) .misty-banner-item.active .misty-banner-info > *").css({
      cssText: "opacity: 1 !important",
    });
    $(".homePage:not(.hide) .misty-banner-item.active .misty-banner-info > *").css({
      transform: "translateY(0)",
    });
    // Logo switch
    $(".homePage:not(.hide) .misty-banner-logo.active").removeClass("active");
    $(`.homePage:not(.hide) .misty-banner-logo[id=${id}]`).addClass("active");
  }

  static staticSwitchCss() {
    $(".homePage:not(.hide) .misty-banner-body").css({
      left: -(this.index * 100).toString() + "%",
      transition: "none",
    });
    $(".homePage:not(.hide) .misty-banner-info > *").css({ cssText: "opacity: 1 !important" });
    $(".homePage:not(.hide) .misty-banner-info > *").css({
      transition: "none",
      transform: "none",
    });
    $(".homePage:not(.hide) .misty-banner-item.active").removeClass("active");
    let id = $(".homePage:not(.hide) .misty-banner-item")
      .eq(this.index)
      .addClass("active")
      .attr("id");
    $(".homePage:not(.hide) .misty-banner-item:not(.active) .misty-banner-info > *").css({
      cssText: "opacity: 0 !important",
    });
    // Logo switch
    $(".homePage:not(.hide) .misty-banner-logo.active").removeClass("active");
    $(`.homePage:not(.hide) .misty-banner-logo[id=${id}]`).addClass("active");
  }

  static transitionListener() {
    const runningTransitions = new Set();
    $(".homePage:not(.hide) .misty-banner-body").on(
      "transitionstart",
      function (e) {
        runningTransitions.add(e.target);
        this.transitionendFlag = false;
      }.bind(this)
    );
    $(".homePage:not(.hide) .misty-banner-body").on(
      "transitionend",
      function (e) {
        runningTransitions.delete(e.target);
        if (runningTransitions.size == 0) {
          if (this.transitionendFlag) {
            if (this.index >= $(".homePage:not(.hide) .misty-banner-item").length - 1) {
              this.index = 1;
              this.staticSwitchCss();
            }
            if (this.index <= 0) {
              this.index = $(".homePage:not(.hide) .misty-banner-item").length - 2;
              this.staticSwitchCss();
            }
          }
          this.transitionendFlag = true;
        }
      }.bind(this)
    );
  }

  static alertDialog() {
    const script = `
        Dashboard.alert("Please slow down！");
        `;
    this.injectCode(script);
  }

  static backwards() {
    this.index -=
      this.index - 1 == -1 ? -($(".homePage:not(.hide) .misty-banner-item").length - 1) : 1;
    this.dynamicSwitchCss();
    this.resetCarouselInterval(); // Reset interval after manual backward switch
  }

  static forwards() {
    this.index +=
      this.index + 1 == $(".homePage:not(.hide) .misty-banner-item").length ? -this.index : 1;
    this.dynamicSwitchCss();
    this.resetCarouselInterval(); // Reset interval after manual forward switch
  }

  static startCarousel() {
    this.resetCarouselInterval(); // Clear any existing interval and start a new one
  }

  static resetCarouselInterval() {
    if (this.bannerInterval) {
      clearInterval(this.bannerInterval);
    }
    this.bannerInterval = setInterval(() => {
      this.forwards();
    }, 12000);
  }

  static addEventListeners() {
    // if (this.eventListenersAdded) return;
    // this.eventListenersAdded = true;

    // Click event listeners
    $(".homePage:not(.hide) .scrollbuttoncontainer-misty.scrollbuttoncontainer-backwards").on(
      "click",
      function (e) {
        if (
          this.index != 0 &&
          this.index != $(".homePage:not(.hide) .misty-banner-item").length - 1
        ) {
          this.backwards();
        } else {
          this.alertDialog();
        }
      }.bind(this)
    );

    $(".homePage:not(.hide) .scrollbuttoncontainer-misty.scrollbuttoncontainer-forwards").on(
      "click",
      function (e) {
        if (
          this.index != 0 &&
          this.index != $(".homePage:not(.hide) .misty-banner-item").length - 1
        ) {
          this.forwards();
        } else {
          this.alertDialog();
        }
      }.bind(this)
    );

    // Touch event listeners
    // Touch start
    $(".homePage:not(.hide) .misty-banner-body").on(
      "touchstart",
      function (e) {
        if (
          this.index != 0 &&
          this.index != $(".homePage:not(.hide) .misty-banner-item").length - 1
        ) {
          this.moveX = 0;
          this.startX = e.targetTouches[0].pageX;
          this.flag = false;
        } else {
          this.alertDialog();
        }
        e.stopPropagation();
      }.bind(this)
    );
    // Touch move
    $(".homePage:not(.hide) .misty-banner-body").on(
      "touchmove",
      function (e) {
        if (
          this.index != 0 &&
          this.index != $(".homePage:not(.hide) .misty-banner-item").length - 1
        ) {
          this.moveX = e.targetTouches[0].pageX - this.startX;
          this.flag = true;
          $(".homePage:not(.hide) .misty-banner-body").css({
            left: -this.index * innerWidth + this.moveX,
            transition: "none",
          });
        }
        e.stopPropagation();
      }.bind(this)
    );
    // Touch end
    $(".homePage:not(.hide) .misty-banner-body").on(
      "touchend",
      function (e) {
        if (
          this.index != 0 &&
          this.index != $(".homePage:not(.hide) .misty-banner-item").length - 1
        ) {
          if (this.flag) {
            if (Math.abs(this.moveX) > 50) {
              if (this.moveX > 0) {
                this.backwards();
              } else if (this.moveX < 0) {
                this.forwards();
              }
            } else {
              // Rebound effect
              $(".homePage:not(.hide) .misty-banner-body").css({
                left: -(this.index * 100).toString() + "%",
                transition: "none",
              });
            }
          }
        }
        e.stopPropagation();
      }.bind(this)
    );

    // Desktop drag event listeners
    $(".homePage:not(.hide) .misty-banner-body").on(
      "mousedown",
      function (e) {
        e.preventDefault();
        if (
          this.index != 0 &&
          this.index != $(".homePage:not(.hide) .misty-banner-item").length - 1
        ) {
          this.dragging = true;
          this.startX = e.pageX;
        } else {
          this.alertDialog();
        }
      }.bind(this)
    );

    $(document).on(
      "mousemove",
      function (e) {
        if (this.dragging) {
          let moveX = e.pageX - this.startX;
          $(".homePage:not(.hide) .misty-banner-body").css({
            left: -this.index * innerWidth + moveX,
            transition: "none",
          });
        }
      }.bind(this)
    );

    $(document).on(
      "mouseup",
      function (e) {
        if (this.dragging) {
          let moveX = e.pageX - this.startX;
          this.dragging = false;
          if (Math.abs(moveX) > 50) {
            if (moveX > 0) {
              this.backwards();
            } else {
              this.forwards();
            }
          } else {
            $(".homePage:not(.hide) .misty-banner-body").css({
              left: -(this.index * 100).toString() + "%",
              transition: "none",
            });
          }
        }
      }.bind(this)
    );
  }

  /* Insert Banner */
  static async initBanner() {
    const banner = `
        <div class="misty-banner">
          <div class="emby-scrollbuttons emby-scrollbuttons-misty" title="">
            <div class="scrollbuttoncontainer-misty scrollbuttoncontainer-backwards">
              <button type="button" class="emby-scrollbuttons-scrollbutton paper-icon-button-light">
                <i class="md-icon autortl material-icons chevron_left"></i>
              </button>
            </div>
            <div class="scrollbuttoncontainer-misty scrollbuttoncontainer-forwards" >
              <button type="button"  class="emby-scrollbuttons-scrollbutton paper-icon-button-light">
                <i class="md-icon autortl material-icons chevron_right"></i>
              </button>
            </div>
          </div>
          <div class="misty-banner-body">
          </div>
          <div class="misty-banner-mask"></div>
          <div class="misty-banner-library">
            <div class="misty-banner-logos"></div>
          </div>
        </div>
        `;
    $(".homePage:not(.hide) .homeSectionsContainer").prepend(banner);

    // Insert data
    this.data = await this.getItems(this.itemQuery);
    if (this.data.Items.length == 0) {
      $(".misty-loading").fadeOut(150, () => $(".misty-loading").remove());
      return;
    }
    for (let detail of this.data.Items) {
      const itemHtml = `
          <div class="misty-banner-item" id="${detail.Id}">
            <img draggable="false" loading="eager" decoding="sync" class="misty-banner-cover" src="${await this.getImageUrl(
              detail.Id,
              this.coverOptions
            )}" alt="Backdrop" style="">
            <div class="misty-banner-info padded-left padded-right">
              <h1>${detail.Name}</h1>
              <div><p>${detail.Overview}</p></div>
              <div><button onclick="Emby.Page.showItem('${detail.Id}')">MORE</button></div>
            </div>
          </div>
          `;

      if (detail.ImageTags && detail.ImageTags.Logo) {
        const logoHtml = `
            <img id="${
              detail.Id
            }" draggable="false" loading="eager" decoding="sync" class="misty-banner-logo" data-banner="img-title" alt="Logo" src="${await this.getImageUrl(
          detail.Id,
          this.logoOptions
        )}">
            `;
        $(".homePage:not(.hide) .misty-banner-logos").append(logoHtml);
      }
      $(".homePage:not(.hide) .misty-banner-body").append(itemHtml);
    }
    // Only check if the first poster has loaded to optimize load speed
    await new Promise((resolve, reject) => {
      let waitLoading = setInterval(() => {
        if (
          document.querySelector(".homePage:not(.hide) .misty-banner-cover")?.complete &&
          (document.querySelector(".layout-mobile") ||
            document.querySelector(".layout-tv") ||
            document.querySelector(".homePage:not(.hide) .section0 .emby-scrollbuttons"))
        ) {
          clearInterval(waitLoading);
          resolve();
        }
      }, 16);
    });

    let firstitem = $(".homePage:not(.hide) .misty-banner-item").first().clone();
    let lastitem = $(".homePage:not(.hide) .misty-banner-item").last().clone();
    $(".homePage:not(.hide) .misty-banner-body").append(firstitem);
    $(".homePage:not(.hide) .misty-banner-body").prepend(lastitem);

    // Move section0 elements into misty-banner-library
    $(".homePage:not(.hide) .section0 .emby-scrollbuttons").remove();
    $(".homePage:not(.hide) .section0")
      .detach()
      .appendTo(".homePage:not(.hide) .misty-banner-library");

    $(".misty-loading").fadeOut(500, () => $(".misty-loading").remove());
    await CommonUtils.sleep(150);
    // Entrance animation
    this.transitionListener();
    let delay = 80; // Media library image interval
    let id = $(".homePage:not(.hide) .misty-banner-item").eq(1).addClass("active").attr("id"); // Initial info animation
    $(`.homePage:not(.hide) .misty-banner-logo[id=${id}]`).addClass("active");

    await CommonUtils.sleep(200); // Animation interval
    $(".homePage:not(.hide) .section0 > div").addClass("misty-banner-library-overflow"); // Disable overflow to prevent media library animation overflow
    $(".homePage:not(.hide) .section0 .card").each((i, dom) =>
      setTimeout(() => $(dom).addClass("misty-banner-library-show"), i * delay)
    ); // Media library animation
    await CommonUtils.sleep(delay * 8 + 1000); // Wait for media library animation to complete
    $(".homePage:not(.hide) .section0 > div").removeClass("misty-banner-library-overflow"); // Enable overflow to allow scrolling
    // Scrolling logic
    this.index = 1;
    this.startCarousel();
  }
}

// Run
if ("BroadcastChannel" in window || "postMessage" in window) {
  if ($("meta[name=application-name]").attr("content") == "Jellyfin") {
    Home.start();
  }
}
