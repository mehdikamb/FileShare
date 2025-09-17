document.addEventListener('DOMContentLoaded', function() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const progressSection = document.getElementById('progressSection');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const resultsSection = document.getElementById('resultsSection');
    const fileInfo = document.getElementById('fileInfo');
    const themeToggle = document.getElementById('themeToggle');
    const uploadModal = document.getElementById('uploadModal');
    const modalClose = document.getElementById('modalClose');
    const cancelUpload = document.getElementById('cancelUpload');
    const confirmUpload = document.getElementById('confirmUpload');
    const selectedFile = document.getElementById('selectedFile');
    const fileName = document.getElementById('fileName');
    const filePassword = document.getElementById('filePassword');

    let pendingFile = null;

    function initTheme() {
        const savedTheme = localStorage.getItem('theme');
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        const theme = savedTheme || systemTheme;

        setTheme(theme);
    }

    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }

    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    }

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            setTheme(e.matches ? 'dark' : 'light');
        }
    });

    themeToggle.addEventListener('click', toggleTheme);

    initTheme();

    function showModal(file) {
        pendingFile = file;
        fileName.textContent = file.name;
        uploadModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function hideModal() {
        uploadModal.style.display = 'none';
        document.body.style.overflow = '';
        pendingFile = null;
        fileInput.value = '';

        filePassword.value = '';
        document.getElementById('singleDownload').checked = false;
        document.querySelector('input[name="expiration"][value="1h"]').checked = true;
    }


    modalClose.addEventListener('click', hideModal);
    cancelUpload.addEventListener('click', hideModal);

    uploadModal.addEventListener('click', (e) => {
        if (e.target === uploadModal) {
            hideModal();
        }
    });

    confirmUpload.addEventListener('click', () => {
        if (pendingFile) {
            const settings = {
                password: filePassword.value || null,
                singleDownload: document.getElementById('singleDownload').checked,
                expiration: document.querySelector('input[name="expiration"]:checked').value
            };
            const fileToUpload = pendingFile;
            hideModal();
            uploadFile(fileToUpload, settings);
        }
    });

    dropZone.addEventListener('click', (e) => {
        if (e.target !== fileInput) {
            fileInput.click();
        }
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            showModal(files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            showModal(e.target.files[0]);
        }
    });

    function uploadFile(file, settings = {}) {
        const formData = new FormData();
        formData.append('file', file);

        if (settings.password) {
            formData.append('password', settings.password);
        }
        if (settings.singleDownload) {
            formData.append('singleDownload', 'true');
        }
        if (settings.expiration) {
            formData.append('expiration', settings.expiration);
        }

        progressSection.style.display = 'block';
        resultsSection.style.display = 'none';

        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentage = Math.round((e.loaded / e.total) * 100);
                progressFill.style.width = percentage + '%';
                progressText.textContent = percentage + '%';
            }
        });

        xhr.addEventListener('load', () => {
            progressSection.style.display = 'none';

            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                showUploadResult(response);
            } else {
                alert('File upload error!');
            }
        });

        xhr.addEventListener('error', () => {
            progressSection.style.display = 'none';
            alert('File upload error!');
        });

        xhr.open('POST', '/upload');
        xhr.send(formData);
    }

    function showUploadResult(response) {
        resultsSection.style.display = 'block';

        fileInfo.innerHTML = `
            <div class="file-item">
                <div class="file-details">
                    <h4><i class="fas fa-file"></i> ${response.filename}</h4>
                    <p>Size: ${formatFileSize(response.size)}</p>
                </div>
                <div class="file-actions">
                    <button onclick="copyToClipboard('${response.url}')" class="copy-btn">
                        <i class="fas fa-copy"></i>
                        <span>Copy Link</span>
                    </button>
                </div>
            </div>
        `;
    }


    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    window.copyToClipboard = function(url) {
        navigator.clipboard.writeText(url);
    };

});

