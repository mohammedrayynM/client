import React, { useState, useRef, useEffect } from 'react';
import { API_BASE } from '@/lib/api';
import { resolveMediaUrl } from '@/lib/mediaUrl';

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/x-png',
  'image/webp'
]);
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const GENERIC_MIMES = new Set(['application/octet-stream', 'binary/octet-stream', '']);

function getFileExtension(name) {
  const match = String(name || '').toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match ? match[1] : '';
}

async function sniffImageType(file) {
  try {
    const buf = await file.slice(0, 12).arrayBuffer();
    const bytes = new Uint8Array(buf);
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
      return 'image/png';
    }
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return 'image/jpeg';
    }
    if (
      bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    ) {
      return 'image/webp';
    }
  } catch {
    // ignore sniff failures
  }
  return null;
}

function isAllowedImageMeta(file) {
  const mime = String(file?.type || '').toLowerCase();
  const ext = getFileExtension(file?.name);
  return ALLOWED_TYPES.has(mime) || ALLOWED_EXTENSIONS.has(ext) || GENERIC_MIMES.has(mime);
}

async function prepareUploadFile(file) {
  if (!file) return null;

  const ext = getFileExtension(file.name);
  const mime = String(file.type || '').toLowerCase();
  if ((ALLOWED_TYPES.has(mime) || ALLOWED_EXTENSIONS.has(ext)) && ext) {
    return file;
  }

  const sniffed = await sniffImageType(file);
  if (!sniffed) return null;

  const extMap = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp'
  };
  const safeExt = ext || extMap[sniffed] || '.jpg';
  const baseName = String(file.name || 'turf-photo').replace(/\.[^.]+$/, '') || 'turf-photo';
  return new File([file], `${baseName}${safeExt}`, { type: sniffed });
}

function parseUploadError(xhr) {
  try {
    const data = JSON.parse(xhr.responseText || '{}');
    return data.error || data.message || `Upload failed (${xhr.status})`;
  } catch {
    return xhr.responseText?.slice(0, 120) || `Upload failed (${xhr.status})`;
  }
}

export default function TurfImageUpload({ photos = [], coverImage = '', onChange }) {
  const [dragging, setDragging] = useState(false);
  const [uploads, setUploads] = useState({});
  const fileInputRef = useRef(null);
  const previewUrlsRef = useRef(new Set());

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrlsRef.current.clear();
    };
  }, []);

  const revokePreviewUrl = (previewUrl) => {
    if (!previewUrl) return;
    URL.revokeObjectURL(previewUrl);
    previewUrlsRef.current.delete(previewUrl);
  };

  const clearUploadPlaceholder = (tempId, previewUrl) => {
    revokePreviewUrl(previewUrl);
    setUploads((prev) => {
      const copy = { ...prev };
      delete copy[tempId];
      return copy;
    });
  };

  const handleFiles = async (files) => {
    const fileList = Array.from(files || []);
    if (!fileList.length) return;

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    const validFiles = [];
    for (const file of fileList) {
      const isValidSize = file.size <= 10 * 1024 * 1024;
      if (!isValidSize) {
        alert(`File too large: ${file.name}. Maximum size is 10MB.`);
        continue;
      }

      const prepared = await prepareUploadFile(file);
      if (!prepared) {
        if (isAllowedImageMeta(file)) {
          alert(`Could not read image: ${file.name}. Try JPG, PNG or WEBP.`);
        } else {
          alert(`Invalid format: ${file.name}. Only JPG, PNG and WEBP are accepted.`);
        }
        continue;
      }
      validFiles.push(prepared);
    }

    if (!validFiles.length) return;

    if (photos.length + validFiles.length > 8) {
      alert('You can upload up to 8 photos maximum.');
      return;
    }

    const token = localStorage.getItem('token') || localStorage.getItem('userToken');
    let nextPhotos = [...photos];
    let nextCover = coverImage;

    for (const file of validFiles) {
      const tempId = Math.random().toString(36).substring(2, 9);
      const previewUrl = URL.createObjectURL(file);
      previewUrlsRef.current.add(previewUrl);

      setUploads((prev) => ({
        ...prev,
        [tempId]: { name: file.name, progress: 0, loading: true, previewUrl }
      }));

      const formData = new FormData();
      formData.append('image', file);

      try {
        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `${API_BASE}/owners/upload-image`, true);
          if (token) {
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          }

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const percent = Math.round((e.loaded / e.total) * 100);
              setUploads((prev) => ({
                ...prev,
                [tempId]: { ...prev[tempId], progress: percent }
              }));
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const res = JSON.parse(xhr.responseText);
                const uploadedUrl = res.url || res.image?.url;
                if (res.success && uploadedUrl) {
                  nextPhotos = [...nextPhotos, uploadedUrl];
                  if (!nextCover) nextCover = uploadedUrl;
                  onChange({
                    photos: nextPhotos,
                    coverImage: nextCover,
                    photosCount: nextPhotos.length
                  });
                  resolve();
                  return;
                }
                reject(new Error(`Upload failed for ${file.name}`));
              } catch {
                reject(new Error(`Upload failed for ${file.name}`));
              }
            } else {
              reject(new Error(parseUploadError(xhr)));
            }
          };

          xhr.onerror = () => reject(new Error(`Network error while uploading ${file.name}`));
          xhr.send(formData);
        });
      } catch (err) {
        alert(err.message || `Upload failed for ${file.name}`);
      } finally {
        clearUploadPlaceholder(tempId, previewUrl);
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => {
    setDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const removePhoto = (photoUrl) => {
    const newPhotos = photos.filter((p) => p !== photoUrl);
    let newCover = coverImage;
    if (coverImage === photoUrl) {
      newCover = newPhotos.length > 0 ? newPhotos[0] : '';
    }
    onChange({
      photos: newPhotos,
      coverImage: newCover,
      photosCount: newPhotos.length
    });
  };

  const setAsCover = (photoUrl) => {
    onChange({
      photos,
      coverImage: photoUrl,
      photosCount: photos.length
    });
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="turf-image-upload-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {photos.length < 8 && (
        <div
          className={`upload-dropzone ${dragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={triggerFileInput}
          style={{
            border: dragging ? '2px dashed var(--emerald-400)' : '2px dashed var(--border-color, #334155)',
            borderRadius: '12px',
            padding: '2.5rem 1.5rem',
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: dragging ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-secondary, #0f172a)',
            boxShadow: dragging ? '0 0 15px rgba(16, 185, 129, 0.15)' : 'none',
            transition: 'all 0.3s ease',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem'
          }}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFiles(e.target.files)}
            multiple
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            style={{ display: 'none' }}
          />

          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke={dragging ? 'var(--emerald-400)' : 'var(--text-muted, #94a3b8)'}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ width: '48px', height: '48px', transition: 'stroke 0.3s' }}
          >
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
            <circle cx="12" cy="13" r="3" />
          </svg>

          <div style={{ fontWeight: 600, color: 'var(--text-primary, #f8fafc)', fontSize: '1.05rem' }}>
            Click to upload photos or drag and drop here
          </div>
          <div style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.85rem' }}>
            Accepted formats: <strong style={{ color: '#cbd5e1' }}>JPG, PNG, WEBP</strong> — Max 10MB each
          </div>
          <div style={{ color: 'var(--emerald-400)', fontSize: '0.85rem', fontWeight: 500 }}>
            You can upload up to 8 photos ({photos.length}/8 uploaded)
          </div>
        </div>
      )}

      {(photos.length > 0 || Object.keys(uploads).length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <label className="form-label" style={{ margin: 0, fontWeight: 600 }}>Uploaded Turf Photos</label>
          <div
            className="photos-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: '1rem',
              width: '100%'
            }}
          >
            {photos.map((photoUrl) => {
              const isCover = coverImage === photoUrl;
              return (
                <div
                  key={photoUrl}
                  className="photo-preview-card"
                  style={{
                    position: 'relative',
                    aspectRatio: '1/1',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    border: isCover ? '2.5px solid var(--emerald-400)' : '1px solid var(--border-color, #334155)',
                    boxShadow: isCover ? '0 0 12px rgba(16, 185, 129, 0.25)' : 'none',
                    transition: 'all 0.25s ease',
                    backgroundColor: 'var(--bg-secondary, #0f172a)'
                  }}
                >
                  <img
                    src={resolveMediaUrl(photoUrl)}
                    alt="Turf photo preview"
                    loading="lazy"
                    decoding="async"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => removePhoto(photoUrl)}
                    style={{
                      position: 'absolute',
                      top: '6px',
                      right: '6px',
                      backgroundColor: 'rgba(239, 68, 68, 0.9)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '12px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                      zIndex: 3
                    }}
                  >
                    ✕
                  </button>

                  {isCover ? (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        backgroundColor: 'var(--emerald-500)',
                        color: 'white',
                        textAlign: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '4px 0',
                        zIndex: 2
                      }}
                    >
                      ★ COVER IMAGE
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAsCover(photoUrl)}
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        backgroundColor: 'rgba(15, 23, 42, 0.75)',
                        border: 'none',
                        color: '#94a3b8',
                        textAlign: 'center',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        padding: '5px 0',
                        cursor: 'pointer',
                        zIndex: 2
                      }}
                    >
                      Make Cover
                    </button>
                  )}
                </div>
              );
            })}

            {Object.entries(uploads).map(([tempId, info]) => (
              <div
                key={tempId}
                style={{
                  position: 'relative',
                  aspectRatio: '1/1',
                  borderRadius: '10px',
                  border: '1px dashed var(--text-muted, #475569)',
                  overflow: 'hidden',
                  backgroundColor: 'rgba(15, 23, 42, 0.4)'
                }}
              >
                {info.previewUrl && (
                  <img
                    src={info.previewUrl}
                    alt={`Uploading ${info.name}`}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      opacity: 0.55
                    }}
                  />
                )}

                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px',
                    gap: '8px',
                    background: info.previewUrl ? 'rgba(15, 23, 42, 0.45)' : 'transparent'
                  }}
                >
                  <div
                    className="progress-spinner"
                    style={{
                      border: '3px solid rgba(16, 185, 129, 0.1)',
                      borderTop: '3px solid var(--emerald-400)',
                      borderRadius: '50%',
                      width: '28px',
                      height: '28px',
                      animation: 'spin 1s linear infinite'
                    }}
                  />

                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f8fafc' }}>
                    Uploading... {info.progress}%
                  </div>

                  <div
                    style={{
                      width: '80%',
                      height: '4px',
                      backgroundColor: 'rgba(255,255,255,0.08)',
                      borderRadius: '2px',
                      overflow: 'hidden'
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${info.progress}%`,
                        backgroundColor: 'var(--emerald-400)',
                        transition: 'width 0.2s ease-out'
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
