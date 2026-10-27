package org.example.fileservice.controller;

import org.example.fileservice.model.FileEntity;
import org.example.fileservice.repo.FileRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/files")
public class FileController {

    @Autowired
    private FileRepository fileRepository;

    private static final String UPLOAD_DIR = "uploads";

    // Get all files
    @GetMapping
    public List<FileEntity> getAllFiles() {
        return fileRepository.findAll();
    }

    // Get file by ID
    @GetMapping("/{id}")
    public ResponseEntity<FileEntity> getFile(@PathVariable Long id) {

        return fileRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    // Create file metadata
    @PostMapping
    public FileEntity createFile(@RequestBody FileEntity file) {
        return fileRepository.save(file);
    }

    // Delete file and its physical content
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteFile(@PathVariable Long id) {

        FileEntity file = fileRepository.findById(id).orElse(null);

        if (file == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("success", false, "error", "File not found"));
        }

        try {
            Path filePath = Paths.get(
                    UPLOAD_DIR,
                    id.toString(),
                    file.getName()
            );

            Files.deleteIfExists(filePath);

            // Remove the now-empty directory if possible
            Path directory = Paths.get(UPLOAD_DIR, id.toString());
            Files.deleteIfExists(directory);

            fileRepository.deleteById(id);

            return ResponseEntity.ok(
                    Map.of("success", true, "message", "File deleted successfully")
            );

        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "error", "Could not delete file"));
        }
    }

    // Get files inside a folder
    @GetMapping("/folder/{folderId}")
    public List<FileEntity> getFilesByFolder(@PathVariable Long folderId) {
        return fileRepository.findByFolderId(folderId);
    }

    // Upload file
    @PostMapping("/upload")
    public ResponseEntity<Map<String, Object>> uploadFile(
            @RequestParam("name") String name,
            @RequestParam(value = "folderId", required = false) Long folderId,
            @RequestParam("file") MultipartFile file) {

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(
                    Map.of("success", false, "error", "Please select a file")
            );
        }

        if (name == null || name.isBlank()) {
            name = file.getOriginalFilename();
        }

        if (name == null || name.isBlank()) {
            return ResponseEntity.badRequest().body(
                    Map.of("success", false, "error", "File name is required")
            );
        }

        Long id = System.currentTimeMillis();

        try {
            String safeFileName = Paths.get(name)
                    .getFileName()
                    .toString();

            Path uploadDirectory = Paths.get(UPLOAD_DIR, id.toString());
            Files.createDirectories(uploadDirectory);

            Path filePath = uploadDirectory.resolve(safeFileName)
                    .normalize();

            if (!filePath.startsWith(uploadDirectory.normalize())) {
                return ResponseEntity.badRequest().body(
                        Map.of("success", false, "error", "Invalid file name")
                );
            }

            Files.copy(file.getInputStream(), filePath);

            FileEntity newFile = new FileEntity();
            newFile.setId(id);
            newFile.setName(safeFileName);
            newFile.setFolderId(folderId);
            newFile.setPath("/files/" + id);

            // Save file size
            newFile.setSize(file.getSize());

            FileEntity saved = fileRepository.save(newFile);

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("file", saved);

            return ResponseEntity.status(HttpStatus.CREATED).body(result);

        } catch (Exception e) {
            // Return a consistent error response
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("error", "Upload failed: " + e.getMessage());

            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(error);
        }
    }

    // Download file
    @GetMapping("/download/{id}")
    public ResponseEntity<?> downloadFile(@PathVariable Long id) {

        FileEntity file = fileRepository.findById(id).orElse(null);

        if (file == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body("File not found");
        }

        Path filePath = Paths.get(
                UPLOAD_DIR,
                id.toString(),
                file.getName()
        );

        if (!Files.exists(filePath) || !Files.isRegularFile(filePath)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body("Physical file not found");
        }

        try {
            byte[] fileContent = Files.readAllBytes(filePath);

            return ResponseEntity.ok()
                    .header(
                            HttpHeaders.CONTENT_DISPOSITION,
                            "attachment; filename=\"" + file.getName() + "\""
                    )
                    .contentType(MediaType.APPLICATION_OCTET_STREAM)
                    .contentLength(fileContent.length)
                    .body(fileContent);

        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error downloading file");
        }
    }
}