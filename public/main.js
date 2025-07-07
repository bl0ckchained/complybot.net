document.addEventListener("DOMContentLoaded", () => {
  // 📩 Save URL + Email
  const form = document.querySelector('form[action="/scan"]');
  if (form) {
    form.addEventListener("submit", () => {
      const url = document.querySelector('input[name="url"]').value;
      const email = document.querySelector('input[name="email"]').value;
      localStorage.setItem("url", url);
      localStorage.setItem("email", email);
    });
  }

  // 💳 Upgrade Buttons
  document.querySelectorAll(".upgrade-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const email = localStorage.getItem("email");
      const url = localStorage.getItem("url");

      if (!email || !url) {
        alert("Please run a scan first from the homepage.");
        return;
      }

      try {
        const res = await fetch("/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, url }),
        });

        const data = await res.json();
        if (!data.url) throw new Error("Missing checkout URL from server");
        window.location.href = data.url;
      } catch (err) {
        alert("⚠️ Error starting checkout. Please try again.");
        console.error(err);
      }
    });
  });

  // 🌙 Dark Mode Toggle
  const toggleBtn = document.getElementById("darkModeToggle");
  if (toggleBtn) {
    const userPref = localStorage.getItem("darkMode");
    if (userPref === "true") {
      document.body.classList.add("dark-mode");
      toggleBtn.textContent = "🌜";
    }

    toggleBtn.addEventListener("click", () => {
      document.body.classList.toggle("dark-mode");
      const isDark = document.body.classList.contains("dark-mode");
      toggleBtn.textContent = isDark ? "🌜" : "🌞";
      localStorage.setItem("darkMode", isDark);
    });
  }

  // 📝 FAQ Toggle
  document.querySelectorAll(".faq-question").forEach((question) => {
    question.addEventListener("click", () => {
      question.classList.toggle("open");
      question.nextElementSibling.classList.toggle("open");
      const symbol = question.querySelector("span");
      symbol.textContent = question.classList.contains("open") ? "-" : "+";
    });
  });

  // 🔍 FAQ Search
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      const query = this.value.toLowerCase();
      document.querySelectorAll(".faq-item").forEach((item) => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(query) ? "block" : "none";
      });
    });
  }
});
