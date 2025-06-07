// Simple in-memory file transfer service
class FileTransferService {
    private pendingFile: File | null = null;

    setPendingFile(file: File) {
        this.pendingFile = file;
    }

    getPendingFile(): File | null {
        const file = this.pendingFile;
        this.pendingFile = null; // Clear after retrieval
        return file;
    }

    hasPendingFile(): boolean {
        return this.pendingFile !== null;
    }
}

// Create singleton instance
export const fileTransferService = new FileTransferService(); 