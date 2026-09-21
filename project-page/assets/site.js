(() => {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealItems = document.querySelectorAll(".reveal");

  if (reducedMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  } else {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -7%" });

    revealItems.forEach((item) => revealObserver.observe(item));
  }

  const sectionLinks = Array.from(document.querySelectorAll(".section-nav-links a"));
  const sections = sectionLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  if (sections.length && "IntersectionObserver" in window) {
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        sectionLinks.forEach((link) => {
          link.classList.toggle("is-active", link.getAttribute("href") === `#${entry.target.id}`);
        });
      });
    }, { rootMargin: "-35% 0px -60%", threshold: 0 });

    sections.forEach((section) => sectionObserver.observe(section));
  }
})();

(() => {
  const metricGroup = document.querySelector("[data-animated-metrics]");
  if (!metricGroup) return;

  const metrics = Array.from(metricGroup.querySelectorAll("[data-metric-value]"));
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const formatMetric = (element, value) => {
    const decimals = Number(element.dataset.metricDecimals || 0);
    const prefix = element.dataset.metricPrefix || "";
    const suffix = element.dataset.metricSuffix || "";
    return `${prefix}${value.toFixed(decimals)}${suffix}`;
  };

  const animateMetric = (element, delay) => {
    const target = Number(element.dataset.metricValue);
    const duration = 1150;

    window.setTimeout(() => {
      element.classList.add("is-counting");
      const startTime = performance.now();

      const step = (now) => {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 4);
        element.textContent = formatMetric(element, target * eased);

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          element.textContent = formatMetric(element, target);
        }
      };

      requestAnimationFrame(step);
    }, delay);
  };

  if (reducedMotion || !("IntersectionObserver" in window)) return;

  metrics.forEach((metric) => {
    metric.textContent = formatMetric(metric, 0);
  });

  const metricObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      metrics.forEach((metric, index) => animateMetric(metric, index * 120));
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.42 });

  metricObserver.observe(metricGroup);
})();

(() => {
  const showcase = document.querySelector("[data-demo-showcase]");
  if (!showcase) return;

  const tasks = {
    picktube: {
      title: "Pick Tube",
      robot: "assets/videos/robot/picktube.mp4?v=trimmed-2",
      ego: [
        "assets/videos/ego/picktube/000003__full.mp4",
        "assets/videos/ego/picktube/000025__full.mp4",
        "assets/videos/ego/picktube/000033__full.mp4",
        "assets/videos/ego/picktube/000055__full.mp4"
      ]
    },
    placebottle: {
      title: "Place Bottle",
      robot: "assets/videos/robot/placebottle.mp4?v=trimmed-2",
      ego: [
        "assets/videos/ego/placebottle/000015.mp4",
        "assets/videos/ego/placebottle/000025.mp4",
        "assets/videos/ego/placebottle/000044.mp4",
        "assets/videos/ego/placebottle/000055.mp4"
      ]
    },
    pourliquid: {
      title: "Pour Liquid",
      robot: "assets/videos/robot/pourliquid.mp4?v=trimmed-2",
      ego: [
        "assets/videos/ego/pourliquid/000004.mp4",
        "assets/videos/ego/pourliquid/000036.mp4",
        "assets/videos/ego/pourliquid/000050.mp4",
        "assets/videos/ego/pourliquid/000055.mp4"
      ]
    }
  };

  const taskPicker = document.querySelector("[data-task-picker]");
  const pickerButton = taskPicker.querySelector(".task-picker-button");
  const pickerValue = taskPicker.querySelector(".task-picker-value");
  const pickerOptions = Array.from(taskPicker.querySelectorAll("[data-task-value]"));
  const taskTitle = document.querySelector("#robot-task-title");
  const robotVideo = document.querySelector("#robot-demo-video");
  const egoVideos = Array.from(document.querySelectorAll("#ego-demo-grid video"));
  let generation = 0;
  let replayTimer = 0;
  let currentTask = "picktube";

  const canPlay = (video) => new Promise((resolve) => {
    if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      resolve();
      return;
    }
    video.addEventListener("canplay", resolve, { once: true });
  });

  const startEgoGroup = (videos, token) => {
    let finished = 0;
    const replay = () => {
      if (token !== generation) return;
      finished = 0;
      videos.forEach((video) => {
        video.pause();
        video.currentTime = 0;
      });
      requestAnimationFrame(() => {
        videos.forEach((video) => video.play().catch(() => {}));
      });
    };

    videos.forEach((video) => {
      video.onended = () => {
        if (token !== generation) return;
        finished += 1;
        if (finished === videos.length) {
          replayTimer = window.setTimeout(replay, 420);
        }
      };
    });

    replay();
  };

  const loadTask = async (key) => {
    const task = tasks[key];
    if (!task) return;
    const token = ++generation;
    window.clearTimeout(replayTimer);
    showcase.classList.add("is-loading");
    taskTitle.textContent = task.title;

    robotVideo.pause();
    robotVideo.src = task.robot;
    robotVideo.load();
    egoVideos.forEach((video, index) => {
      video.pause();
      video.onended = null;
      video.src = task.ego[index];
      video.load();
    });

    await Promise.all([canPlay(robotVideo), ...egoVideos.map(canPlay)]);
    if (token !== generation) return;
    showcase.classList.remove("is-loading");
    robotVideo.currentTime = 0;
    robotVideo.play().catch(() => {});
    startEgoGroup(egoVideos, token);
  };

  const setPickerOpen = (open) => {
    taskPicker.classList.toggle("is-open", open);
    pickerButton.setAttribute("aria-expanded", String(open));
  };

  pickerButton.addEventListener("click", () => {
    setPickerOpen(!taskPicker.classList.contains("is-open"));
  });

  pickerOptions.forEach((option) => {
    option.addEventListener("click", () => {
      const key = option.dataset.taskValue;
      setPickerOpen(false);
      if (!tasks[key] || key === currentTask) return;
      currentTask = key;
      pickerValue.textContent = tasks[key].title;
      pickerOptions.forEach((item) => {
        item.setAttribute("aria-selected", String(item.dataset.taskValue === key));
      });
      loadTask(key);
    });
  });

  document.addEventListener("click", (event) => {
    if (!taskPicker.contains(event.target)) setPickerOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setPickerOpen(false);
      pickerButton.focus();
    }
  });

  if ("IntersectionObserver" in window) {
    const showcaseObserver = new IntersectionObserver((entries, observer) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      loadTask(currentTask);
    }, { rootMargin: "300px 0px" });
    showcaseObserver.observe(showcase);
  } else {
    loadTask(currentTask);
  }
})();

(() => {
  const videos = Array.from(document.querySelectorAll("video[data-viewport-loop], video[data-viewport-hold]"));
  if (!videos.length) return;

  const HOLD_DELAY = 900;
  const timers = new WeakMap();

  const clearHold = (video) => {
    window.clearTimeout(timers.get(video));
    timers.delete(video);
  };

  videos.forEach((video) => {
    if (!video.hasAttribute("data-viewport-hold")) return;
    video.addEventListener("ended", () => {
      clearHold(video);
      timers.set(video, window.setTimeout(() => {
        video.currentTime = 0;
        video.play().catch(() => {});
      }, HOLD_DELAY));
    });
  });

  if (!("IntersectionObserver" in window)) {
    videos.forEach((video) => video.play().catch(() => {}));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const video = entry.target;
      if (entry.isIntersecting) {
        if (video.ended) video.currentTime = 0;
        video.play().catch(() => {});
      } else if (!video.paused) {
        clearHold(video);
        video.pause();
      }
    });
  }, { rootMargin: "200px 0px" });

  videos.forEach((video) => observer.observe(video));
})();

(() => {
  const buttons = document.querySelectorAll("[data-copy-target]");

  buttons.forEach((button) => {
    button.addEventListener("click", async () => {
      const target = document.getElementById(button.dataset.copyTarget);
      if (!target) return;

      const citation = target.innerText.trim();
      try {
        await navigator.clipboard.writeText(citation);
        const originalLabel = button.textContent;
        button.textContent = "Copied";
        window.setTimeout(() => {
          button.textContent = originalLabel;
        }, 1600);
      } catch {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(target);
        selection.removeAllRanges();
        selection.addRange(range);
        button.textContent = "Select & copy";
      }
    });
  });
})();
