// reading-progress.js

let userId    = window.USER_ID;
let bookId    = window.BOOK_ID;
let bookTitle = window.BOOK_TITLE;

/**
 * Extracts the CSRF token from the input element.
 */
function getCSRFToken() {
    refreshCSRFToken();

    const input = document.querySelector('input[name="csrf_token"]');

    return input ? input.value : '';
}

/**
 * Replaces the CSRF token in the DOM.
 * @param {string} newToken
 */
function setCSRFToken(newToken) {
    const input = document.querySelector('input[name="csrf_token"]');
    if (input) {
        input.value = newToken;
    } else {
        console.warn("CSRF token input not found.");
    }
}

/**
 * Fetches a new CSRF token from the server and updates the DOM.
 */
async function refreshCSRFToken() {
    try {
        const response = await fetch("/refresh-csrf", {
            credentials: "include"
        });

        if (!response.ok) {
            throw new Error("CSRF token refresh failed.");
        }

        const data = await response.json();
        if (data.csrf_token) {
            setCSRFToken(data.csrf_token);
            // console.log("CSRF token refreshed.");
        }
    } catch (error) {
        console.error("Error refreshing CSRF token:", error);
    }
}

/**
 * Extract the current EPUB CFI from the URL hash.
 */
function getCurrentCFI() {
    const cfi = reader.currentLocationCfi;

    return cfi;
}

/**
 * Extract the current Reading Percentage from the progress div.
 */
function getCurrentPercentage() {
    let progressDiv = document.getElementById("progress");

    var percentage = progressDiv.textContent;
    percentage = percentage.replace("%", "");

    return parseFloat(percentage);
}

/**
 * Updates the progress percentage display.
 */
function updateProgressDisplay() {
    let progressDiv = document.getElementById("progress");

    reader.book.ready.then((()=>{
        let locations_key = reader.book.key()+'-locations';
        let stored_locations = localStorage.getItem(locations_key);
        let make_locations, save_locations;

        if (stored_locations) {
            make_locations = Promise.resolve(reader.book.locations.load(stored_locations));
            // No-op because locations are already saved
            save_locations = ()=>{};
        } else {
            make_locations = reader.book.locations.generate();

            save_locations = ()=>{
                localStorage.setItem(locations_key, reader.book.locations.save());
            };
        }

        make_locations.then(()=>{
            reader.rendition.on(
                'relocated',
                (location)=>{
                    let percentage = Math.round(location.end.percentage*100);

                    progressDiv.textContent=percentage+"%";
                }
            );

            reader.rendition.reportLocation();
            progressDiv.style.visibility = "visible";
        }).then(save_locations);
    }));
}

/**
 * Save the user's current progress to the server.
 */
function saveReadingProgress() {
    updateProgressDisplay();

    const cfi = getCurrentCFI();
    if (!cfi) {
        console.warn("No valid CFI found in location hash.");
        return;
    }

    percentage = getCurrentPercentage();
    if (percentage < 0 || percentage > 100) {
        console.warn("Invalid percentage value:", percentage);
        percentage = 0;
    }

    // console.log("Saving at:", cfi);

    const payload = JSON.stringify({
        user_id:      userId,
        book_id:      bookId,
        book_name:    bookTitle,
        location:     cfi,
        percent_read: percentage,
    });

    fetch('/progress', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken()
        },
        credentials: 'include',
        body: payload
    })
    .then(response => {
        if (response.status === 400 || response.status === 403) {
            alert("Your session may have expired. Please refresh the page or log in again.");
            refreshCSRFToken();
        }
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
            console.log("Restoring to:", startLocation);
        } else {
            console.log("No saved progress found.");
        }

        reader.rendition.display(startLocation || '');
    });

    // Save progress whenever the custom `locationchange` event is fired
    window.addEventListener("locationchange", () => {
        saveReadingProgress();
    });

    // Optional: save progress if user leaves the page
    window.addEventListener("beforeunload", () => {
        saveReadingProgress();
    });

    // Periodically refresh CSRF token every 15 minutes
    setInterval(refreshCSRFToken, 15 * 60 * 1000);
});
