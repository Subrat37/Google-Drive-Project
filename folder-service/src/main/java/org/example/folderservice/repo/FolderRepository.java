package org.example.folderservice.repo;

import org.example.folderservice.model.FolderEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FolderRepository extends JpaRepository<FolderEntity,Long> {
    List<FolderEntity> findByParentId(Long parentId);
}
