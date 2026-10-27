package org.example.searchservice.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.List;
import java.util.Map;

@FeignClient(
        name = "file-service",
        url = "${file.service.url}"
)
public interface FileSearchClient {

    @GetMapping("/api/files")
    List<Map<String, Object>> getAllFiles();

    @GetMapping("/api/files/folder/{folderId}")
    List<Map<String, Object>> getAllFilesByFolderId(@PathVariable("folderId") Long folderId);
}