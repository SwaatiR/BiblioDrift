/**
 * BiblioDrift Core Logic with GoodReads Mood Analysis
 * Handles 3D rendering, API fetching, mood analysis, and LocalStorage management.
 */

const API_BASE = 'https://www.googleapis.com/books/v1/volumes';
const MOOD_API_BASE = 'http://localhost:5000/api/v1';

class BookRenderer {
    constructor() {
        this.libraryManager = new LibraryManager();
        this.moodAnalyzer = new MoodAnalyzer();
    }

    async createBookElement(bookData) {
        const { id, volumeInfo } = bookData;
        const title = volumeInfo.title || "Untitled";
        const authors = volumeInfo.authors ? volumeInfo.authors.join(", ") : "Unknown Author";
        const thumb = volumeInfo.imageLinks ? volumeInfo.imageLinks.thumbnail : 'https://via.placeholder.com/128x196?text=No+Cover';
        const description = volumeInfo.description ? volumeInfo.description.substring(0, 100) + "..." : "A mysterious tome waiting to be opened.";

        // Try to get mood analysis for this book
        let vibe = this.generateVibe(description);
        let moodTags = [];
        
        try {
            const moodData = await this.moodAnalyzer.getBookMood(title, authors);
            if (moodData && moodData.success) {
                vibe = moodData.mood_analysis.bibliodrift_vibe || vibe;
                moodTags = moodData.mood_analysis.primary_moods || [];
            }
        } catch (error) {
            console.log('Mood analysis not available, using fallback vibe');
        }

        // Randomize spine color slightly for variety
        const spineColors = ['#5D4037', '#4E342E', '#3E2723', '#2C2420', '#8D6E63'];
        const randomSpine = spineColors[Math.floor(Math.random() * spineColors.length)];

        // Create Container
        const scene = document.createElement('div');
        scene.className = 'book-scene';

        // Generate mood tags HTML
        const moodTagsHTML = moodTags.length > 0 
            ? `<div class="mood-tags">${moodTags.slice(0, 2).map(tag => `<span class="mood-tag mood-${tag.mood}">${tag.mood}</span>`).join('')}</div>`
            : '';

        // Structure
        scene.innerHTML = `
            <div class="book" data-id="${id}">
                <div class="book__face book__face--front">
                    <img src="${thumb.replace('http:', 'https:')}" alt="${title}">
                    ${moodTagsHTML}
                </div>
                <div class="book__face book__face--spine" style="background: ${randomSpine}"></div>
                <div class="book__face book_face--right"></div>
                <div class="book__face book__face--back">
                    <div>
                        <div style="font-weight: bold; font-size: 0.9rem; margin-bottom: 0.5rem;">${title}</div>
                        <div class="handwritten-note">
                            Bookseller's Note: "${vibe}"
                        </div>
                        ${moodTags.length > 0 ? `
                        <div class="mood-analysis">
                            <small>Mood Analysis:</small>
                            <div class="mood-tags-back">
                                ${moodTags.slice(0, 3).map(tag => `<span class="mood-tag-small">${tag.mood}</span>`).join('')}
                            </div>
                        </div>` : ''}
                    </div>
                    <div class="book-actions">
                        <button class="btn-icon add-btn" title="Add to Library"><i class="fa-regular fa-heart"></i></button>
                        <button class="btn-icon mood-btn" title="Analyze Mood" onclick="event.stopPropagation(); this.closest('.book-scene').querySelector('.book-renderer').showMoodAnalysis('${title}', '${authors}')"><i class="fa-solid fa-brain"></i></button>
                        <button class="btn-icon" title="Flip Back" onclick="event.stopPropagation(); this.closest('.book').classList.remove('flipped')"><i class="fa-solid fa-rotate-left"></i></button>
                    </div>
                </div>
            </div>
            <div class="glass-overlay">
                <strong>${title}</strong><br>
                <small>${authors}</small>
                ${moodTags.length > 0 ? `<div class="glass-mood-tags">${moodTags.slice(0, 2).map(tag => `<span class="glass-mood-tag">${tag.mood}</span>`).join('')}</div>` : ''}
            </div>
        `;

        // Store reference for mood analysis
        scene.querySelector('.book-scene').bookRenderer = this;

        // Interaction: Flip
        const bookEl = scene.querySelector('.book');
        scene.addEventListener('click', (e) => {
            if (!e.target.closest('.btn-icon')) {
                bookEl.classList.toggle('flipped');
            }
        });

        // Interaction: Add to Library
        const addBtn = scene.querySelector('.add-btn');
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.libraryManager.addBook(bookData, 'want'); // Default to "Want to Read"
            addBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
            setTimeout(() => addBtn.innerHTML = '<i class="fa-solid fa-heart"></i>', 2000);
        });

        return scene;
    }

    async showMoodAnalysis(title, author) {
        try {
            const moodData = await this.moodAnalyzer.analyzeMood(title, author);
            if (moodData && moodData.success) {
                this.displayMoodModal(title, moodData.mood_analysis);
            } else {
                alert('Mood analysis not available for this book.');
            }
        } catch (error) {
            console.error('Error showing mood analysis:', error);
            alert('Error loading mood analysis.');
        }
    }

    displayMoodModal(title, moodAnalysis) {
        const modal = document.createElement('div');
        modal.className = 'mood-modal';
        
        // Create modal content safely using DOM methods
        const content = document.createElement('div');
        content.className = 'mood-modal-content';
        
        // Header
        const header = document.createElement('div');
        header.className = 'mood-modal-header';
        
        const headerTitle = document.createElement('h3');
        headerTitle.textContent = `Mood Analysis: ${title}`;
        
        const closeButton = document.createElement('button');
        closeButton.className = 'close-modal';
        closeButton.textContent = '×';
        
        header.appendChild(headerTitle);
        header.appendChild(closeButton);
        
        // Body
        const body = document.createElement('div');
        body.className = 'mood-modal-body';
        
        // Overall Sentiment section
        const overallSection = document.createElement('div');
        overallSection.className = 'mood-section';
        
        const overallHeading = document.createElement('h4');
        overallHeading.textContent = 'Overall Sentiment';
        
        const sentimentBar = document.createElement('div');
        sentimentBar.className = 'sentiment-bar';
        
        const sentimentFill = document.createElement('div');
        sentimentFill.className = 'sentiment-fill';
        const compoundScore = moodAnalysis.overall_sentiment?.compound_score || 0;
        sentimentFill.style.width = `${(compoundScore + 1) * 50}%`;
        
        sentimentBar.appendChild(sentimentFill);
        
        const moodDescription = document.createElement('p');
        moodDescription.textContent = moodAnalysis.mood_description || '';
        
        overallSection.appendChild(overallHeading);
        overallSection.appendChild(sentimentBar);
        overallSection.appendChild(moodDescription);
        
        // Primary Moods section
        const primarySection = document.createElement('div');
        primarySection.className = 'mood-section';
        
        const primaryHeading = document.createElement('h4');
        primaryHeading.textContent = 'Primary Moods';
        
        const moodTagsContainer = document.createElement('div');
        moodTagsContainer.className = 'mood-tags-large';
        
        const primaryMoods = Array.isArray(moodAnalysis.primary_moods) ? moodAnalysis.primary_moods : [];
        primaryMoods.forEach(mood => {
            const span = document.createElement('span');
            const moodName = String(mood.mood || '');
            span.className = `mood-tag-large mood-${moodName}`;
            span.textContent = `${moodName} (${mood.confidence || mood.frequency || 0})`;
            moodTagsContainer.appendChild(span);
        });
        
        primarySection.appendChild(primaryHeading);
        primarySection.appendChild(moodTagsContainer);
        
        // BiblioDrift Vibe section
        const vibeSection = document.createElement('div');
        vibeSection.className = 'mood-section';
        
        const vibeHeading = document.createElement('h4');
        vibeHeading.textContent = 'BiblioDrift Vibe';
        
        const vibeQuote = document.createElement('div');
        vibeQuote.className = 'vibe-quote';
        vibeQuote.textContent = `"${moodAnalysis.bibliodrift_vibe || ''}"`;
        
        vibeSection.appendChild(vibeHeading);
        vibeSection.appendChild(vibeQuote);
        
        // Reviews analyzed section
        const reviewsSection = document.createElement('div');
        reviewsSection.className = 'mood-section';
        
        const reviewsInfo = document.createElement('small');
        reviewsInfo.textContent = `Based on ${moodAnalysis.total_reviews_analyzed || 0} GoodReads reviews`;
        
        reviewsSection.appendChild(reviewsInfo);
        
        // Assemble everything
        body.appendChild(overallSection);
        body.appendChild(primarySection);
        body.appendChild(vibeSection);
        body.appendChild(reviewsSection);
        
        content.appendChild(header);
        content.appendChild(body);
        modal.appendChild(content);

        document.body.appendChild(modal);

        // Close modal functionality
        closeButton.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    generateVibe(text) {
        // Simple heuristic to mock "AI" vibes (fallback)
        const vibes = [
            "Perfect for a rainy afternoon.",
            "Smells like old paper and adventure.",
            "A quiet companion for coffee.",
            "Heartwarming and gentle.",
            "Will make you travel without moving."
        ];
        return vibes[Math.floor(Math.random() * vibes.length)];
    }

    async renderCuratedSection(query, elementId) {
        const container = document.getElementById(elementId);
        if (!container) return; // Not on page

        try {
            const res = await fetch(`${API_BASE}?q=${query}&maxResults=5&printType=books`);
            const data = await res.json();

            if (data.items) {
                container.innerHTML = '';
                for (const book of data.items) {
                    const bookElement = await this.createBookElement(book);
                    container.appendChild(bookElement);
                }
            }
        } catch (err) {
            console.error("Failed to fetch books", err);
            container.innerHTML = '<p>The shelves are dusty... (API Error)</p>';
        }
    }
}

class MoodAnalyzer {
    async getBookMood(title, author) {
        try {
            const response = await fetch(`${MOOD_API_BASE}/mood-tags`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ title, author })
            });
            return await response.json();
        } catch (error) {
            console.error('Error fetching mood tags:', error);
            return null;
        }
    }

    async analyzeMood(title, author) {
        try {
            const response = await fetch(`${MOOD_API_BASE}/analyze-mood`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ title, author })
            });
            return await response.json();
        } catch (error) {
            console.error('Error analyzing mood:', error);
            return null;
        }
    }
}

class LibraryManager {
    constructor() {
        this.storageKey = 'bibliodrift_library';
        this.library = JSON.parse(localStorage.getItem(this.storageKey)) || {
            current: [],
            want: [],
            finished: []
        };
    }

    addBook(book, shelf) {
        // Check duplicates
        if (this.findBook(book.id)) return;

        this.library[shelf].push(book);
        this.save();
        console.log(`Added ${book.volumeInfo.title} to ${shelf}`);
    }

    findBook(id) {
        for (const shelf in this.library) {
            if (this.library[shelf].some(b => b.id === id)) return true;
        }
        return false;
    }

    save() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.library));
    }

    renderShelf(shelfName, elementId) {
        const container = document.getElementById(elementId);
        if (!container) return;

        const books = this.library[shelfName];
        if (books.length === 0) return; // Keep empty state if empty

        // Clear empty state text if we have books
        // But keep the shelf label which is typically a sibling or parent logic, 
        // In my HTML: span.shelf-label is sibling. container contains books.

        // Remove "empty state" div if exists
        const emptyState = container.querySelector('.empty-state');
        if (emptyState) emptyState.remove();

        books.forEach(book => {
            const renderer = new BookRenderer();
            const el = renderer.createBookElement(book);
            // On shelves, we might want interaction to be "Move" or "Remove", 
            // but for MVP reuse the same card.
            container.appendChild(el);
        });
    }
}

class ThemeManager {
    constructor() {
        this.themeKey = 'bibliodrift_theme';
        this.toggleBtn = document.getElementById('themeToggle');
        this.currentTheme = localStorage.getItem(this.themeKey) || 'day';
        
        this.init();
    }

    init() {
        if (!this.toggleBtn) return;
        
        this.applyTheme(this.currentTheme);
        
        this.toggleBtn.addEventListener('click', () => {
            this.currentTheme = this.currentTheme === 'day' ? 'night' : 'day';
            this.applyTheme(this.currentTheme);
            localStorage.setItem(this.themeKey, this.currentTheme);
        });
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const icon = this.toggleBtn.querySelector('i');
        if (theme === 'night') {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    }
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    const renderer = new BookRenderer();
    const libManager = new LibraryManager();
    const themeManager = new ThemeManager();

    // Search Handler
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = searchInput.value.trim();
                if (query) {
                    window.location.href = `index.html?q=${encodeURIComponent(query)}`;
                }
            }
        });
    }

    // Check URL Params for Search
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('q');

    if (searchQuery && document.getElementById('row-rainy')) {
        // We are on Discovery page and have a query
        document.querySelector('main').innerHTML = `
            <section class="hero" style="padding: 2rem 0;">
                <h1>Results for "${searchQuery}"</h1>
            </section>
            <section class="curated-section">
                <div class="curated-row" id="search-results" style="flex-wrap: wrap;"></div>
            </section>
        `;
        renderer.renderCuratedSection(searchQuery, 'search-results');
        if (searchInput) searchInput.value = searchQuery;
        return; // Stop default rendering
    }

    // Check if Home (Default)
    if (document.getElementById('row-rainy')) {
        renderer.renderCuratedSection('subject:mystery+atmosphere', 'row-rainy');
        renderer.renderCuratedSection('authors:amitav+ghosh|authors:arundhati+roy|subject:india', 'row-indian');
        renderer.renderCuratedSection('subject:classic+fiction', 'row-classics');
        renderer.renderCuratedSection('subject:fiction', 'row-genre');
    }

    // Check if Library
    if (document.getElementById('shelf-want')) {
        libManager.renderShelf('want', 'shelf-want');
        libManager.renderShelf('current', 'shelf-current');
        libManager.renderShelf('finished', 'shelf-finished');
    }

   // Scroll Manager (Back to Top)
const backToTopBtn = document.getElementById('backToTop');
if (backToTopBtn) {
    window.addEventListener('scroll', () => {
        if (window.scrollY > 200) {
            backToTopBtn.classList.remove('hidden');
        } else {
            backToTopBtn.classList.add('hidden');
        }
    });

    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}
});

function handleAuth(event) {
  event.preventDefault();

  const email = document.getElementById("email").value;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    alert("Enter a valid email address");
    return;
  }

  window.location.href = "library.html";
}
