const API = {
    files: "http://localhost:8081/api/files",
    folders: "http://localhost:8082/api/folders",
    search: "http://localhost:8083/api/search"
};

async function requestJson(url, options = {}) {
    let response;

    try {
        response = await fetch(url, options);
    } catch (error) {
        throw new Error(
            `Cannot connect to ${url}. Check whether the backend is running and CORS is configured correctly.`
        );
    }

    if (!response.ok) {
        const detail = await response.text().catch(() => "");

        throw new Error(
            `${response.status} ${response.statusText}` +
            (detail ? `: ${detail}` : "")
        );
    }

    if (response.status === 204) {
        return null;
    }

    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
        return response.json();
    }

    return response.text();
}