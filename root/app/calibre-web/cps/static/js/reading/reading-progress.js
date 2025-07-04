// reading-progress.js

let userId = window.USER_ID;
let bookId = window.BOOK_ID;
let book = null;
let rendition = null;

/**
 * Extracts the CSRF token from the meta tag in the document head.
 */
function getCSRFToken() {
    const input = document.querySelector('input[name="csrf_token"]');
    return input ? input.value : '';
}

/**
 * Extract the current EPUB CFI from the URL hash.
 */
function getCurrentCFI() {
    const hash = window.location.hash;
    const cfi  = hash.startsWith("#") ? hash.slice(1) : hash;

    return cfi;
}

/**
 * Save the user's current progress to the server.
 */
function saveProgress() {
    const cfi = getCurrentCFI();
    if (!cfi) {
        console.warn("No valid CFI found in location hash.");
        return;
    }

    console.log("saving progress at:", cfi);

    const payload = JSON.stringify({
        user_id: userId,
        book_id: bookId,
        location: cfi
    })

    fetch('/progress', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken()
        },
        credentials: 'include',
        body: payload
    })
    .catch(err => console.error("Progress save failed:", err));
}

document.addEventListener("DOMContentLoaded", () => {
    // Restore last known progress
    fetch(`/progress?user_id=${userId}&book_id=${bookId}`)
    .then(response => response.json())
    .then(data => {
        const startLocation = data.location || undefined;

        if (startLocation) {
            console.log("Restoring to location:", startLocation);
        } else {
            console.log("No saved progress found.");
        }

        reader.rendition.display(startLocation || '');
        reader.rendition.start();
    });

    // Save progress whenever the custom `locationchange` event is fired
    window.addEventListener("locationchange", () => {
        saveProgress();
    });

    // Optional: save progress if user leaves the page
    window.addEventListener("beforeunload", saveProgress);
});
