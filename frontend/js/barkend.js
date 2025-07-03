class BarkendApp {
  constructor() {
    this.breeds = {};
    this.favorites = JSON.parse(localStorage.getItem("barkendFavorites")) || [];
    this.stats = JSON.parse(localStorage.getItem("barkendStats")) || {
      imagesViewed: 0,
      sessionStart: Date.now(),
    };
    this.currentPage = 1;
    this.itemsPerPage = 12;
    this.currentBreeds = [];
    this.sessionTimer = null;
    this.init();
  }

  async init() {
    await this.loadBreeds();
    this.loadAllBreeds();
    this.updateStats();
    this.startSessionTimer();
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.getElementById("breedSearch").addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.searchBreeds();
      }
    });

    // Close modal when clicking outside
    document.getElementById("dogModal").addEventListener("click", (e) => {
      if (e.target.id === "dogModal") {
        this.closeModal();
      }
    });

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeModal();
      }
    });
  }

  async loadBreeds() {
    try {
      const response = await fetch("https://dog.ceo/api/breeds/list/all");
      const data = await response.json();

      if (data.status === "success") {
        this.breeds = data.message;
        document.getElementById("totalBreedsCount").textContent = Object.keys(
          this.breeds,
        ).length;
      }
    } catch (error) {
      console.error("Error loading breeds:", error);
      this.showError("Failed to load dog breeds. Please try again.");
    }
  }

  async loadAllBreeds() {
    this.showLoading("breedResults");

    try {
      const breedList = [];
      for (const [breed, subBreeds] of Object.entries(this.breeds)) {
        if (subBreeds.length > 0) {
          for (const subBreed of subBreeds) {
            breedList.push(`${breed}/${subBreed}`);
          }
        } else {
          breedList.push(breed);
        }
      }

      this.currentBreeds = breedList;
      this.currentPage = 1;
      await this.displayBreeds();
      this.setupPagination();
    } catch (error) {
      console.error("Error loading breeds:", error);
      this.showError("Failed to load breeds. Please try again.");
    }
  }

  async displayBreeds() {
    const container = document.getElementById("breedResults");
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const breedsToShow = this.currentBreeds.slice(startIndex, endIndex);

    if (breedsToShow.length === 0) {
      container.innerHTML =
        '<div class="empty-state"><i class="fas fa-search"></i><h3>No breeds found</h3><p>Try searching for something else.</p></div>';
      return;
    }

    const breedCards = await Promise.all(
      breedsToShow.map((breed) => this.createBreedCard(breed)),
    );

    container.innerHTML = breedCards.filter((card) => card).join("");
  }

  async createBreedCard(breed) {
    try {
      const response = await fetch(
        `https://dog.ceo/api/breed/${breed}/images/random`,
      );
      const data = await response.json();

      if (data.status === "success") {
        const breedName = breed
          .replace("/", " ")
          .split(" ")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");

        const isFavorite = this.favorites.includes(breed);
        const heartIcon = isFavorite ? "fas fa-heart" : "far fa-heart";
        const heartColor = isFavorite ? "color: #ef4444;" : "";

        return `
                    <div class="dog-card" onclick="barkend.showBreedDetails('${breed}')">
                        <img src="${data.message}" alt="${breedName}" class="dog-image"
                             onerror="this.src='https://via.placeholder.com/300x200?text=Image+Not+Found'"
                             onload="barkend.incrementImageViews()">
                        <div class="dog-name">${breedName}</div>
                        <div class="dog-info">Click to see more images</div>
                        <div class="dog-actions">
                            <button class="isolated-btn-primary" onclick="event.stopPropagation(); barkend.showBreedDetails('${breed}')" style="all: unset; font-family: -apple-system, sans-serif; font-size: 12px; font-weight: 500; color: white; background: #007bff; border: 1px solid #007bff; border-radius: 4px; padding: 6px 12px; margin: 2px; cursor: pointer; display: inline-block; text-align: center; text-decoration: none; line-height: 1.2; vertical-align: middle;">
                                <i class="fas fa-images"></i> Gallery
                            </button>
                            <button class="isolated-btn-secondary" onclick="event.stopPropagation(); barkend.toggleFavorite('${breed}')"
                                    style="all: unset; font-family: -apple-system, sans-serif; font-size: 12px; font-weight: 500; color: white; background: #6c757d; border: 1px solid #6c757d; border-radius: 4px; padding: 6px 12px; margin: 2px; cursor: pointer; display: inline-block; text-align: center; text-decoration: none; line-height: 1.2; vertical-align: middle; ${heartColor}">
                                <i class="${heartIcon}"></i> ${isFavorite ? "Favorited" : "Favorite"}
                            </button>
                        </div>
                    </div>
                `;
      }
    } catch (error) {
      console.error("Error loading breed image:", error);
    }

    return "";
  }

  async searchBreeds() {
    const query = document
      .getElementById("breedSearch")
      .value.toLowerCase()
      .trim();

    if (!query) {
      this.loadAllBreeds();
      return;
    }

    this.showLoading("breedResults");

    const filteredBreeds = [];
    for (const [breed, subBreeds] of Object.entries(this.breeds)) {
      if (breed.toLowerCase().includes(query)) {
        if (subBreeds.length > 0) {
          for (const subBreed of subBreeds) {
            filteredBreeds.push(`${breed}/${subBreed}`);
          }
        } else {
          filteredBreeds.push(breed);
        }
      } else {
        for (const subBreed of subBreeds) {
          if (subBreed.toLowerCase().includes(query)) {
            filteredBreeds.push(`${breed}/${subBreed}`);
          }
        }
      }
    }

    this.currentBreeds = filteredBreeds;
    this.currentPage = 1;
    await this.displayBreeds();
    this.setupPagination();
  }

  async loadRandomDogs() {
    this.showLoading("randomDogs");

    try {
      const promises = Array.from({ length: 12 }, () =>
        fetch("https://dog.ceo/api/breeds/image/random").then((r) => r.json()),
      );

      const results = await Promise.all(promises);
      const randomDogs = results.filter((r) => r.status === "success");

      const container = document.getElementById("randomDogs");
      container.innerHTML = randomDogs
        .map(
          (dog, index) => `
                <div class="dog-card">
                    <img src="${dog.message}" alt="Random Dog ${index + 1}" class="dog-image"
                         onerror="this.src='https://via.placeholder.com/300x200?text=Image+Not+Found'"
                         onload="barkend.incrementImageViews()">
                    <div class="dog-name">Random Pup #${index + 1}</div>
                    <div class="dog-info">A surprise doggo just for you!</div>
                    <div class="dog-actions">
                        <button class="isolated-btn-accent" onclick="barkend.openImageModal('${dog.message}', 'Random Pup #${index + 1}')" style="all: unset; font-family: -apple-system, sans-serif; font-size: 12px; font-weight: 500; color: white; background: #20c997; border: 1px solid #20c997; border-radius: 4px; padding: 6px 12px; margin: 2px; cursor: pointer; display: inline-block; text-align: center; text-decoration: none; line-height: 1.2; vertical-align: middle;">
                            <i class="fas fa-eye"></i> View Full
                        </button>
                    </div>
                </div>
            `,
        )
        .join("");
    } catch (error) {
      console.error("Error loading random dogs:", error);
      this.showError("Failed to load random dogs. Please try again.");
    }
  }

  async showBreedDetails(breed) {
    try {
      const response = await fetch(`https://dog.ceo/api/breed/${breed}/images`);
      const data = await response.json();

      if (data.status === "success") {
        const breedName = breed
          .replace("/", " ")
          .split(" ")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");

        const images = data.message.slice(0, 20); // Limit to 20 images
        const isFavorite = this.favorites.includes(breed);

        const modalContent = `
                    <div style="margin-bottom: 20px;">
                        <h3>${breedName}</h3>
                        <p>Here are some beautiful ${breedName.toLowerCase()} images from around the world!</p>
                        <button class="isolated-btn-${isFavorite ? "secondary" : "primary"}"
                                onclick="barkend.toggleFavorite('${breed}'); barkend.showBreedDetails('${breed}')" style="all: unset; font-family: -apple-system, sans-serif; font-size: 12px; font-weight: 500; color: white; background: ${isFavorite ? "#6c757d" : "#007bff"}; border: 1px solid ${isFavorite ? "#6c757d" : "#007bff"}; border-radius: 4px; padding: 6px 12px; margin: 2px; cursor: pointer; display: inline-block; text-align: center; text-decoration: none; line-height: 1.2; vertical-align: middle;">
                            <i class="${isFavorite ? "fas fa-heart" : "far fa-heart"}"></i>
                            ${isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                        </button>
                    </div>
                    <div class="breed-images">
                        ${images
                          .map(
                            (img) => `
                            <img src="${img}" alt="${breedName}" class="breed-image"
                                 onclick="barkend.openImageModal('${img}', '${breedName}')"
                                 onerror="this.style.display='none'"
                                 onload="barkend.incrementImageViews()">
                        `,
                          )
                          .join("")}
                    </div>
                `;

        this.showModal(breedName, modalContent);
      }
    } catch (error) {
      console.error("Error loading breed details:", error);
      this.showError("Failed to load breed details. Please try again.");
    }
  }

  toggleFavorite(breed) {
    const index = this.favorites.indexOf(breed);
    if (index > -1) {
      this.favorites.splice(index, 1);
    } else {
      this.favorites.push(breed);
    }

    localStorage.setItem("barkendFavorites", JSON.stringify(this.favorites));
    this.updateStats();
    this.loadFavorites();
  }

  async loadFavorites() {
    const container = document.getElementById("favoritesList");

    if (this.favorites.length === 0) {
      container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-heart"></i>
                    <h3>No favorites yet</h3>
                    <p>Start exploring breeds and add your favorites!</p>
                </div>
            `;
      return;
    }

    this.showLoading("favoritesList");

    try {
      const favoriteCards = await Promise.all(
        this.favorites.map((breed) => this.createBreedCard(breed)),
      );

      container.innerHTML = favoriteCards.filter((card) => card).join("");
    } catch (error) {
      console.error("Error loading favorites:", error);
      this.showError("Failed to load favorites. Please try again.");
    }
  }

  openImageModal(imageUrl, title) {
    const modalContent = `
            <div style="text-align: center;">
                <img src="${imageUrl}" alt="${title}" style="max-width: 100%; max-height: 70vh; border-radius: 10px; margin-bottom: 15px;">
                <h4>${title}</h4>
                <p>Right-click to save this adorable pup!</p>
            </div>
        `;
    this.showModal(title, modalContent);
  }

  showModal(title, content) {
    document.getElementById("modalTitle").textContent = title;
    document.getElementById("modalContent").innerHTML = content;
    document.getElementById("dogModal").style.display = "block";
  }

  closeModal() {
    document.getElementById("dogModal").style.display = "none";
  }

  setupPagination() {
    const totalPages = Math.ceil(this.currentBreeds.length / this.itemsPerPage);
    const paginationContainer = document.getElementById("breedPagination");

    if (totalPages <= 1) {
      paginationContainer.innerHTML = "";
      return;
    }

    let paginationHTML = "";

    // Previous button
    if (this.currentPage > 1) {
      paginationHTML += `
                <button class="isolated-page-btn" onclick="barkend.changePage(${this.currentPage - 1})" style="all: unset; font-family: -apple-system, sans-serif; font-size: 12px; font-weight: 500; color: #495057; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 6px 10px; margin: 2px; cursor: pointer; display: inline-block; text-align: center; text-decoration: none; line-height: 1.2; vertical-align: middle;">
                    <i class="fas fa-chevron-left"></i>
                </button>
            `;
    }

    // Page numbers
    const startPage = Math.max(1, this.currentPage - 2);
    const endPage = Math.min(totalPages, this.currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
      paginationHTML += `
                <button class="isolated-page-btn${i === this.currentPage ? "-active" : ""}"
                        onclick="barkend.changePage(${i})" style="all: unset; font-family: -apple-system, sans-serif; font-size: 12px; font-weight: 500; color: ${i === this.currentPage ? "white" : "#495057"}; background: ${i === this.currentPage ? "#007bff" : "#f8f9fa"}; border: 1px solid ${i === this.currentPage ? "#007bff" : "#dee2e6"}; border-radius: 4px; padding: 6px 10px; margin: 2px; cursor: pointer; display: inline-block; text-align: center; text-decoration: none; line-height: 1.2; vertical-align: middle;">
                    ${i}
                </button>
            `;
    }

    // Next button
    if (this.currentPage < totalPages) {
      paginationHTML += `
                <button class="isolated-page-btn" onclick="barkend.changePage(${this.currentPage + 1})" style="all: unset; font-family: -apple-system, sans-serif; font-size: 12px; font-weight: 500; color: #495057; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 6px 10px; margin: 2px; cursor: pointer; display: inline-block; text-align: center; text-decoration: none; line-height: 1.2; vertical-align: middle;">
                    <i class="fas fa-chevron-right"></i>
                </button>
            `;
    }

    paginationContainer.innerHTML = paginationHTML;
  }

  async changePage(page) {
    this.currentPage = page;
    await this.displayBreeds();
    this.setupPagination();
  }

  showLoading(containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = `
            <div class="loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading amazing dogs...</p>
            </div>
        `;
  }

  showError(message) {
    const errorHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Oops! Something went wrong</h3>
                <p>${message}</p>
            </div>
        `;

    // Try to show in the current active tab
    const activeTab = document.querySelector(".tab-content.active");
    if (activeTab) {
      const container = activeTab.querySelector(
        ".dog-grid, #randomDogs, #favoritesList",
      );
      if (container) {
        container.innerHTML = errorHTML;
      }
    }
  }

  incrementImageViews() {
    this.stats.imagesViewed++;
    this.updateStats();
  }

  updateStats() {
    document.getElementById("imagesViewedCount").textContent =
      this.stats.imagesViewed;
    document.getElementById("favoritesCount").textContent =
      this.favorites.length;
    localStorage.setItem("barkendStats", JSON.stringify(this.stats));
  }

  startSessionTimer() {
    this.sessionTimer = setInterval(() => {
      const sessionTime = Date.now() - this.stats.sessionStart;
      const minutes = Math.floor(sessionTime / 60000);
      const seconds = Math.floor((sessionTime % 60000) / 1000);

      document.getElementById("sessionTime").textContent =
        minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
    }, 1000);
  }

  async loadPopularBreeds() {
    // Simulate popular breeds based on favorites and common breeds
    const popularBreeds = [
      "labrador",
      "golden/retriever",
      "bulldog/english",
      "beagle",
      "poodle/standard",
    ];
    const container = document.getElementById("popularBreeds");

    this.showLoading("popularBreeds");

    try {
      const breedCards = await Promise.all(
        popularBreeds.map((breed) => this.createBreedCard(breed)),
      );

      container.innerHTML = `
                <div class="dog-grid">
                    ${breedCards.filter((card) => card).join("")}
                </div>
            `;
    } catch (error) {
      console.error("Error loading popular breeds:", error);
      container.innerHTML = "<p>Failed to load popular breeds.</p>";
    }
  }
}

// Tab management functions
function showTab(tabName) {
  // Hide all tabs
  const tabs = document.querySelectorAll(".tab-content");
  tabs.forEach((tab) => tab.classList.remove("active"));

  // Remove active class from all nav tabs
  const navTabs = document.querySelectorAll(".nav-tab");
  navTabs.forEach((tab) => tab.classList.remove("active"));

  // Show selected tab
  document.getElementById(tabName).classList.add("active");
  event.target.classList.add("active");

  // Load content for specific tabs
  switch (tabName) {
    case "random":
      if (document.getElementById("randomDogs").innerHTML.trim() === "") {
        barkend.loadRandomDogs();
      }
      break;
    case "favorites":
      barkend.loadFavorites();
      break;
    case "stats":
      barkend.loadPopularBreeds();
      break;
  }
}

// Global functions for easy access
window.showTab = showTab;
window.barkend = null;

// Initialize the app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.barkend = new BarkendApp();
});
