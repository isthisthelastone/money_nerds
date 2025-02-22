export function copyToClipboard(text: string): Promise<void> {
    //eslint-disable-next-line
    if (typeof navigator !== "undefined" && navigator.clipboard) {
        //eslint-disable-next-line
        return navigator.clipboard.writeText(text)
            .then(() => {
                console.log("Text copied to clipboard successfully!");
            })
            .catch(err => {
                console.error("Failed to copy text: ", err);
            });
    } else {
        return Promise.reject(new Error("Clipboard API not supported in this environment"));
    }
}