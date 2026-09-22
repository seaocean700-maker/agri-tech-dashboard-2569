// ==========================================================================
// APP.JS - Smart Agri-Tech Dashboard & Spatial Portfolio Management
// ==========================================================================

let currentTheme = 'light';
let activeFilters = {
    keyword: '',
    province: '',
    crop: '',
    tech: ''
};
let selectedProjectId = null;
let mapInstance = null;
let markersArray = [];
let tileLayerInstance = null;
let calendarCurrentDate = new Date(2026, 5, 1);
let selectedCalendarDate = '2026-06-19';

// Map Tiles (ใช้งานได้ทั้งดับเบิ้ลคลิกไฟล์ และบนเว็บเซิร์ฟเวอร์ ไม่ติด 403)
const mapTiles = {
    light: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    topo: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'
};

// Color palette for pins by crop
const cropPinColors = {
    "ข้าว": "#0284c7",
    "ผำ (คอนโด)": "#10b981",
    "ทุเรียน / กล้วยไข่": "#eab308",
    "ไม้ดอกไม้ประดับ": "#ec4899",
    "ส้มโอขาวใหญ่": "#f97316",
    "มะพร้าว / พืชแซม": "#14b8a6",
    "หอมแบ่ง": "#8b5cf6",
    "เกษตรผสมผสาน": "#22c55e",
    "เกษตรผสมผสาน (ฝรั่ง/พืชผัก)": "#84cc16",
    "เมล่อน": "#a855f7"
};

document.addEventListener("DOMContentLoaded", () => {
    if (window.lucide) lucide.createIcons();
    populateFilterDropdowns();
    initMap();
    setupEventListeners();
    renderDashboard();
});

function populateFilterDropdowns() {
    if (typeof projectsData === 'undefined') return;

    const provSelect = document.getElementById("filter-province");
    const cropSelect = document.getElementById("filter-crop");
    const techSelect = document.getElementById("filter-tech");

    const provinces = [...new Set(projectsData.map(p => p.province).filter(Boolean))].sort();
    const crops = [...new Set(projectsData.map(p => p.crop).filter(Boolean))].sort();
    const technologies = [...new Set(projectsData.map(p => p.technology).filter(Boolean))].sort();

    if (provSelect) {
        provinces.forEach(prov => {
            const opt = document.createElement("option");
            opt.value = prov;
            opt.textContent = prov;
            provSelect.appendChild(opt);
        });
    }

    const cropEmojis = {
        "ข้าว": "🌾",
        "ผำ (คอนโด)": "🟢",
        "ทุเรียน / กล้วยไข่": "👑",
        "ไม้ดอกไม้ประดับ": "🌸",
        "ส้มโอขาวใหญ่": "🍊",
        "มะพร้าว / พืชแซม": "🥥",
        "หอมแบ่ง": "🧅",
        "เกษตรผสมผสาน": "🌱",
        "เกษตรผสมผสาน (ฝรั่ง/พืชผัก)": "🍐",
        "เมล่อน": "🍈"
    };

    if (cropSelect) {
        crops.forEach(crop => {
            const opt = document.createElement("option");
            opt.value = crop;
            opt.textContent = `${cropEmojis[crop] || '🌱'} ${crop}`;
            cropSelect.appendChild(opt);
        });
    }

    if (techSelect) {
        technologies.forEach(tech => {
            const opt = document.createElement("option");
            opt.value = tech;
            opt.textContent = tech;
            techSelect.appendChild(opt);
        });
    }
}

function initMap() {
    const mapElement = document.getElementById("map");
    if (!mapElement) return;

    mapInstance = L.map("map", {
        center: [13.7367, 100.5231],
        zoom: 6,
        minZoom: 5,
        maxZoom: 16,
        zoomControl: true
    });

    updateMapTileLayer();
    addMapLegend();
}

function updateMapTileLayer() {
    if (!mapInstance) return;

    if (tileLayerInstance) {
        mapInstance.removeLayer(tileLayerInstance);
    }
    
    // ใช้ Esri World Street Map แสดงแผนที่ถนน ภาษาไทยชัดเจน ไม่ติดบล็อก 403
    tileLayerInstance = L.tileLayer(mapTiles.light, {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ',
        maxZoom: 18
    }).addTo(mapInstance);
}

function addMapLegend() {
    if (!mapInstance) return;

    const legend = L.control({ position: 'bottomright' });

    legend.onAdd = function () {
        const div = L.DomUtil.create('div', 'map-legend-box');
        div.innerHTML = `<h4 class="legend-header">ชนิดพืช / สัญลักษณ์</h4>`;
        
        for (const [crop, color] of Object.entries(cropPinColors)) {
            div.innerHTML += `
                <div class="legend-item">
                    <span class="legend-dot" style="background-color: ${color};"></span>
                    <span>${crop}</span>
                </div>
            `;
        }
        return div;
    };

    legend.addTo(mapInstance);
}

function setupEventListeners() {
    const themeBtn = document.getElementById("theme-toggle");
    if (themeBtn) {
        themeBtn.addEventListener("click", () => {
            const body = document.body;
            if (currentTheme === 'dark') {
                body.classList.remove("dark-theme");
                body.classList.add("light-theme");
                currentTheme = 'light';
                themeBtn.innerHTML = '<i data-lucide="moon"></i>';
            } else {
                body.classList.remove("light-theme");
                body.classList.add("dark-theme");
                currentTheme = 'dark';
                themeBtn.innerHTML = '<i data-lucide="sun"></i>';
            }
            if (window.lucide) lucide.createIcons();
            updateMapTileLayer();
        });
    }

    const searchInput = document.getElementById("search-input");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            activeFilters.keyword = e.target.value.toLowerCase().trim();
            renderDashboard();
        });
    }

    const provSelect = document.getElementById("filter-province");
    if (provSelect) {
        provSelect.addEventListener("change", (e) => {
            activeFilters.province = e.target.value;
            renderDashboard();
        });
    }

    const cropSelect = document.getElementById("filter-crop");
    if (cropSelect) {
        cropSelect.addEventListener("change", (e) => {
            activeFilters.crop = e.target.value;
            renderDashboard();
        });
    }

    const techSelect = document.getElementById("filter-tech");
    if (techSelect) {
        techSelect.addEventListener("change", (e) => {
            activeFilters.tech = e.target.value;
            renderDashboard();
        });
    }

    const resetBtn = document.getElementById("btn-reset-filters");
    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            activeFilters = { keyword: '', province: '', crop: '', tech: '' };
            selectedProjectId = null;

            if (searchInput) searchInput.value = '';
            if (provSelect) provSelect.value = '';
            if (cropSelect) cropSelect.value = '';
            if (techSelect) techSelect.value = '';

            if (mapInstance) {
                mapInstance.setView([13.7367, 100.5231], 6);
            }

            renderDashboard();
        });
    }

    const downloadReportBtn = document.getElementById("btn-download-report");
    if (downloadReportBtn) {
        downloadReportBtn.addEventListener("click", downloadProjectReport);
    }

    const downloadImgBtn = document.getElementById("btn-download-image");
    if (downloadImgBtn) {
        downloadImgBtn.addEventListener("click", downloadInfographicAsImage);
    }

    const tabBtns = document.querySelectorAll(".tab-btn");
    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetViewId = btn.getAttribute("data-view");
            
            tabBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            
            const tabContents = document.querySelectorAll(".tab-content");
            tabContents.forEach(content => content.classList.remove("active-tab"));
            
            const targetView = document.getElementById(targetViewId);
            if (targetView) {
                targetView.classList.add("active-tab");
            }
            
            if (targetViewId === 'dashboard-view' && mapInstance) {
                setTimeout(() => {
                    mapInstance.invalidateSize(true);
                }, 150);
            }
            
            if (targetViewId === 'workspace-view') {
                renderCalendar();
                renderAreaProgress();
            }
        });
    });

    const prevMonthBtn = document.getElementById("btn-prev-month");
    if (prevMonthBtn) {
        prevMonthBtn.addEventListener("click", () => {
            calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() - 1);
            renderCalendar();
        });
    }

    const nextMonthBtn = document.getElementById("btn-next-month");
    if (nextMonthBtn) {
        nextMonthBtn.addEventListener("click", () => {
            calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() + 1);
            renderCalendar();
        });
    }

    document.addEventListener("click", (e) => {
        if (activeTooltipEl && !e.target.closest(".calendar-event-tag")) {
            removeActiveTooltip();
        }
    });
}

function getFilteredProjects() {
    if (typeof projectsData === 'undefined') return [];

    return projectsData.filter(proj => {
        const matchesKeyword = !activeFilters.keyword || 
            (proj.title && proj.title.toLowerCase().includes(activeFilters.keyword)) ||
            (proj.province && proj.province.toLowerCase().includes(activeFilters.keyword)) ||
            (proj.crop && proj.crop.toLowerCase().includes(activeFilters.keyword)) ||
            (proj.technology && proj.technology.toLowerCase().includes(activeFilters.keyword)) ||
            (proj.farmerName && proj.farmerName.toLowerCase().includes(activeFilters.keyword));

        const matchesProvince = !activeFilters.province || proj.province === activeFilters.province;
        const matchesCrop = !activeFilters.crop || proj.crop === activeFilters.crop;
        const matchesTech = !activeFilters.tech || proj.technology === activeFilters.tech;
        const matchesSelection = !selectedProjectId || proj.id === selectedProjectId;

        return matchesKeyword && matchesProvince && matchesCrop && matchesTech && matchesSelection;
    });
}

function renderDashboard() {
    const filteredProjects = getFilteredProjects();
    updateKPIs(filteredProjects);
    renderMapMarkers(filteredProjects);
    renderInfographic(filteredProjects);
    renderKanbanBoard(filteredProjects);
    renderPortfolioGrid(filteredProjects);
    renderCalendar();
    renderAreaProgress();
}

function updateKPIs(filteredList) {
    const totalProjects = filteredList.length;
    let totalArea = 0;
    let totalFarmers = 0;
    let avgYield = 0;

    if (totalProjects > 0) {
        totalArea = filteredList.reduce((sum, p) => sum + (p.kpis ? (p.kpis.area || 0) : 0), 0);
        totalFarmers = filteredList.reduce((sum, p) => sum + (p.kpis ? (p.kpis.farmers || 0) : 0), 0);
        const sumYield = filteredList.reduce((sum, p) => sum + (p.kpis ? (p.kpis.yieldIncrease || 0) : 0), 0);
        avgYield = Math.round(sumYield / totalProjects);
    }

    animateNumberValue("val-total-projects", parseInt(document.getElementById("val-total-projects")?.textContent || "0"), totalProjects, "", 600);
    animateNumberValue("val-total-area", parseInt((document.getElementById("val-total-area")?.textContent || "0").replace(/,/g, '')), Math.round(totalArea), " ไร่", 600);
    animateNumberValue("val-total-farmers", parseInt((document.getElementById("val-total-farmers")?.textContent || "0").replace(/,/g, '')), totalFarmers, " ราย", 600);
    animateNumberValue("val-average-yield", parseInt((document.getElementById("val-average-yield")?.textContent || "0").replace(/\+/g, '').replace(/%/g, '')), avgYield, "%", 600, "+");
}

function animateNumberValue(id, start, end, suffix = "", duration = 1000, prefix = "") {
    const obj = document.getElementById(id);
    if (!obj) return;

    if (start === end) {
        obj.textContent = prefix + end.toLocaleString() + suffix;
        return;
    }
    
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const currentVal = Math.floor(progress * (end - start) + start);
        obj.textContent = prefix + currentVal.toLocaleString() + suffix;
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.textContent = prefix + end.toLocaleString() + suffix;
        }
    };
    window.requestAnimationFrame(step);
}

function renderMapMarkers(filteredList) {
    if (!mapInstance) return;

    markersArray.forEach(m => mapInstance.removeLayer(m));
    markersArray = [];

    filteredList.forEach(proj => {
        if (!proj.coords || proj.coords.length !== 2) return;

        const isSelected = selectedProjectId === proj.id;
        const pinColor = cropPinColors[proj.crop] || '#10b981';
        const size = isSelected ? 22 : 16;
        const glow = isSelected ? `box-shadow: 0 0 16px ${pinColor}; transform: scale(1.2);` : 'box-shadow: 0 2px 6px rgba(0,0,0,0.3);';
        
        const customIcon = L.divIcon({
            className: 'custom-map-pin',
            html: `<div style="background-color: ${pinColor}; width: ${size}px; height: ${size}px; border-radius: 50%; border: 3px solid #ffffff; ${glow} transition: all 0.2s ease;"></div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2]
        });

        const marker = L.marker(proj.coords, { icon: customIcon }).addTo(mapInstance);

        marker.bindTooltip(`
            <div style="font-family: Prompt, sans-serif; font-size: 0.85rem;">
                <strong style="color: ${pinColor};">● จ. ${proj.province}</strong> (${proj.crop})<br>
                <span style="font-size: 0.78rem; color: #64748b;">${proj.farmerName || ''}</span>
            </div>
        `, {
            direction: 'top',
            offset: [0, -10],
            opacity: 0.98
        });

        marker.on("click", () => {
            if (selectedProjectId === proj.id) {
                selectedProjectId = null;
            } else {
                selectedProjectId = proj.id;
                mapInstance.setView(proj.coords, 9);
            }
            renderDashboard();
        });

        markersArray.push(marker);
    });
}

function renderInfographic(filteredList) {
    const infoProv = document.getElementById("info-selected-province");
    const infoTitle = document.getElementById("info-project-name");
    const infoSub = document.getElementById("info-project-sub");
    const infoContext = document.getElementById("info-context");
    const infoPainpoint = document.getElementById("info-painpoint");
    const infoTech = document.getElementById("info-tech-detail");
    const infoImpact = document.getElementById("info-impact");

    // Container สำหรับแกลเลอรีภาพ ก่อน-หลัง
    let galleryContainer = document.getElementById("info-gallery-container");
    if (!galleryContainer) {
        const flowWrapper = document.querySelector(".infographic-flow");
        if (flowWrapper) {
            galleryContainer = document.createElement("div");
            galleryContainer.id = "info-gallery-container";
            galleryContainer.className = "gallery-wrapper";
            flowWrapper.parentNode.insertBefore(galleryContainer, flowWrapper.nextSibling);
        }
    }

    if (selectedProjectId) {
        const proj = projectsData.find(p => p.id === selectedProjectId);
        if (proj) {
            if (infoProv) {
                infoProv.textContent = `จ. ${proj.province}`;
                infoProv.className = "province-tag";
            }
            if (infoTitle) infoTitle.textContent = proj.title;
            if (infoSub) infoSub.textContent = `เกษตรกร: ${proj.farmerName || '-'} | พืช: ${proj.crop} | ${proj.zoningSuitability || ''}`;
            if (infoContext) infoContext.textContent = proj.context;
            if (infoPainpoint) infoPainpoint.textContent = proj.painpoint;
            if (infoTech) infoTech.textContent = proj.techDetail;
            if (infoImpact) infoImpact.textContent = proj.impact;

            // Render Before / After Images
            if (galleryContainer) {
                const imgBefore = proj.images?.before || 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=400&auto=format&fit=crop&q=60';
                const imgAfter = proj.images?.after || 'https://images.unsplash.com/photo-1586771107445-d3ca888129ff?w=400&auto=format&fit=crop&q=60';
                
                galleryContainer.innerHTML = `
                    <div class="gallery-title-row">
                        <i data-lucide="image"></i>
                        <span>ภาพเปรียบเทียบแปลงต้นแบบ (Before - After)</span>
                    </div>
                    <div class="before-after-grid">
                        <div class="photo-card" onclick="window.open('${imgBefore}', '_blank')">
                            <span class="photo-label label-before">ก่อนปรับปรุง</span>
                            <img src="${imgBefore}" alt="ก่อนปรับปรุง" loading="lazy" />
                            <p class="photo-caption">${proj.images?.captionBefore || 'สภาพแปลงและปัญหาเดิม'}</p>
                        </div>
                        <div class="photo-card" onclick="window.open('${imgAfter}', '_blank')">
                            <span class="photo-label label-after">หลังใช้นวัตกรรม</span>
                            <img src="${imgAfter}" alt="หลังใช้นวัตกรรม" loading="lazy" />
                            <p class="photo-caption">${proj.images?.captionAfter || 'ผลลัพธ์หลังประยุกต์ใช้เทคโนโลยี'}</p>
                        </div>
                    </div>
                `;
            }
            if (window.lucide) lucide.createIcons();
            return;
        }
    }

    if (filteredList.length === 1) {
        const proj = filteredList[0];
        if (infoProv) {
            infoProv.textContent = `จ. ${proj.province}`;
            infoProv.className = "province-tag";
        }
        if (infoTitle) infoTitle.textContent = proj.title;
        if (infoSub) infoSub.textContent = `เกษตรกร: ${proj.farmerName || '-'} | พืช: ${proj.crop} | ${proj.zoningSuitability || ''}`;
        if (infoContext) infoContext.textContent = proj.context;
        if (infoPainpoint) infoPainpoint.textContent = proj.painpoint;
        if (infoTech) infoTech.textContent = proj.techDetail;
        if (infoImpact) infoImpact.textContent = proj.impact;
        if (galleryContainer) galleryContainer.innerHTML = "";
        return;
    }

    // Overview Default Display
    if (infoProv) {
        infoProv.textContent = "ภาพรวมทุกโครงการ";
        infoProv.className = "province-tag overview-tag";
    }
    if (infoTitle) infoTitle.textContent = "ภาพรวมความสำเร็จโครงการส่งเสริมการขยายผลเทคโนโลยีเกษตร 2569";
    if (infoSub) infoSub.textContent = `รวมผลงานสนับสนุน ${filteredList.length} แปลงต้นแบบในพื้นที่เป้าหมาย 18 จังหวัด`;
    if (infoContext) infoContext.textContent = "ขับเคลื่อนการขยายผลเทคโนโลยีและนวัตกรรมเกษตรที่เหมาะสมเชิงพื้นที่ มุ่งเน้นการปรับใช้เทคโนโลยีให้สอดคล้องกับศักยภาพดิน น้ำ สภาพแวดล้อม และบริบทชุมชนเพื่อสร้างความยั่งยืน";
    if (infoPainpoint) infoPainpoint.textContent = "เกษตรกรเผชิญปัญหาต้นทุนปุ๋ย สารเคมี ค่าพลังงานสูบน้ำที่ปรับตัวสูง การเปลี่ยนแปลงสภาพภูมิอากาศ และข้อจำกัดด้านพื้นที่/ความอุดมสมบูรณ์ของดิน";
    if (infoTech) infoTech.textContent = "บูรณาการการทำนาเปียกสลับแห้ง (AWD), การจัดการดินตามค่าวิเคราะห์, ถ่านไบโอชาร์, ไมคอร์ไรซา, เชื้อราไตรโคเดอร์มา, ระบบน้ำ IoT และโรงเรือนอัจฉริยะ";
    if (infoImpact) infoImpact.textContent = "ลดต้นทุนการผลิต 15-40% ประหยัดน้ำและพลังงาน ลดการปล่อยก๊าซเรือนกระจก และยกระดับคุณภาพและปริมาณผลผลิตอย่างเป็นรูปธรรม";
    
    if (galleryContainer) {
        galleryContainer.innerHTML = "";
    }
}

function renderKanbanBoard(filteredList) {
    const planningContainer = document.getElementById("tasks-planning");
    const progressContainer = document.getElementById("tasks-in-progress");
    const doneContainer = document.getElementById("tasks-done");

    if (!planningContainer || !progressContainer || !doneContainer) return;

    planningContainer.innerHTML = "";
    progressContainer.innerHTML = "";
    doneContainer.innerHTML = "";

    let countPln = 0, countProg = 0, countDn = 0;

    const kanbanIndicator = document.getElementById("kanban-filter-indicator");
    if (kanbanIndicator) {
        if (selectedProjectId) {
            const proj = projectsData.find(p => p.id === selectedProjectId);
            kanbanIndicator.textContent = `ตัวกรอง: โครงการ จ. ${proj ? proj.province : ''}`;
        } else {
            kanbanIndicator.textContent = "แสดงงานทุกโครงการ";
        }
    }

    const allFilteredTasks = [];
    filteredList.forEach(proj => {
        if (proj.tasks && Array.isArray(proj.tasks)) {
            proj.tasks.forEach(task => {
                allFilteredTasks.push({ task, proj });
            });
        }
    });

    const priorityWeight = { "high": 3, "medium": 2, "low": 1 };
    allFilteredTasks.sort((a, b) => {
        return (priorityWeight[b.task.priority] || 1) - (priorityWeight[a.task.priority] || 1);
    });

    allFilteredTasks.forEach(({ task, proj }) => {
        const cardEl = createTaskCardElement(task, proj);

        if (task.status === "planning") {
            planningContainer.appendChild(cardEl);
            countPln++;
        } else if (task.status === "in-progress" || task.status === "review") {
            progressContainer.appendChild(cardEl);
            countProg++;
        } else if (task.status === "done") {
            doneContainer.appendChild(cardEl);
            countDn++;
        }
    });

    const countPlnEl = document.getElementById("count-planning");
    const countProgEl = document.getElementById("count-in-progress");
    const countDnEl = document.getElementById("count-done");

    if (countPlnEl) countPlnEl.textContent = countPln;
    if (countProgEl) countProgEl.textContent = countProg;
    if (countDnEl) countDnEl.textContent = countDn;

    if (window.lucide) lucide.createIcons();
}

function createTaskCardElement(task, project) {
    const card = document.createElement("div");
    card.className = "task-card";
    card.setAttribute("draggable", "true");
    card.setAttribute("id", task.id);
    card.setAttribute("data-project-id", project.id);

    card.addEventListener("dragstart", handleDragStart);
    card.addEventListener("dragend", handleDragEnd);

    card.innerHTML = `
        <div class="task-project-tag">
            <span class="crop-badge crop-badge-${getCropClass(project.crop)}">
                <i data-lucide="${getCropIcon(project.crop)}"></i> ${project.crop}
            </span>
            <span>จ. ${project.province}</span>
        </div>
        <div class="task-title">${task.title}</div>
        <div class="task-desc">${task.desc}</div>
        <div class="task-date-row">
            <i data-lucide="calendar"></i>
            <span>กำหนดส่ง: ${formatDateThai(task.date)}</span>
        </div>
        <div class="task-footer">
            <div class="task-assignee">
                <span class="assignee-avatar">${task.assignee?.avatar || '👨‍🌾'}</span>
                <span class="assignee-name">${task.assignee?.name || 'ทีมงาน'}</span>
            </div>
            <span class="task-priority priority-${task.priority || 'low'}">
                ${task.priority === 'high' ? 'ด่วนที่สุด' : task.priority === 'medium' ? 'สำคัญ' : 'ทั่วไป'}
            </span>
        </div>
    `;

    return card;
}

let draggedItem = null;
function handleDragStart(e) {
    draggedItem = this;
    this.classList.add("dragged");
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.id);
    e.dataTransfer.setData('project-id', this.getAttribute('data-project-id'));
}

function handleDragEnd() {
    this.classList.remove("dragged");
    draggedItem = null;
}

window.allowDrop = function(e) { e.preventDefault(); };
window.drop = function(e) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    const projectId = parseInt(e.dataTransfer.getData('project-id'));
    
    let column = e.target;
    while (column && !column.classList.contains("kanban-column")) {
        column = column.parentElement;
    }

    if (column && taskId && projectId) {
        const newStatus = column.getAttribute("data-status");
        const targetProject = projectsData.find(p => p.id === projectId);
        if (targetProject && targetProject.tasks) {
            const targetTask = targetProject.tasks.find(t => t.id === taskId);
            if (targetTask) {
                targetTask.status = newStatus;
                renderDashboard();
            }
        }
    }
};

// --- RENDER PORTFOLIO CARDS GRID (Rich Visuals & Context) ---
function renderPortfolioGrid(filteredList) {
    const gridContainer = document.getElementById("portfolio-grid-container");
    if (!gridContainer) return;

    gridContainer.innerHTML = "";

    if (filteredList.length === 0) {
        gridContainer.innerHTML = `
            <div class="no-results glass-panel" style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-secondary);">
                <i data-lucide="info" style="width: 48px; height: 48px; margin-bottom: 12px; color: var(--color-accent);"></i>
                <p>ไม่พบแปลงเกษตรตามเงื่อนไขตัวกรอง กรุณาล้างตัวกรองหรือค้นหาใหม่</p>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
    }

    // ภาพตัวแทนธรรมชาติของแต่ละพืช (กรณีแปลงใดยังไม่มีรูปใน images.after)
    const defaultCropCovers = {
    "ข้าว": "https://images.unsplash.com/photo-1586771107445-d3ca888129ff?w=600&auto=format&fit=crop&q=60", // ทุ่งนาข้าวเขียว
    "ผำ (คอนโด)": "https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?w=600&auto=format&fit=crop&q=60", // ฟาร์มแนวตั้ง/ถาดเพาะ
    "ทุเรียน / กล้วยไข่": "https://images.unsplash.com/photo-1587132137056-bfbf0166836e?w=600&auto=format&fit=crop&q=60", // กล้วย/ผลไม้สวน
    "ไม้ดอกไม้ประดับ": "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=600&auto=format&fit=crop&q=60", // โรงเรือนไม้ดอก
    "ส้มโอขาวใหญ่": "https://images.unsplash.com/photo-1557800636-894a64c1696f?w=600&auto=format&fit=crop&q=60", // สวนผลไม้รสเปรี้ยว/ส้ม
    "มะพร้าว / พืชแซม": "https://images.unsplash.com/photo-1544378730-8b5104b18790?w=600&auto=format&fit=crop&q=60", // สวนมะพร้าว
    "หอมแบ่ง": "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=60", // แปลงพืชผัก/หอม
    "เกษตรผสมผสาน": "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=600&auto=format&fit=crop&q=60", // แปลงเกษตรผสมผสาน
    "เกษตรผสมผสาน (ฝรั่ง/พืชผัก)": "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=600&auto=format&fit=crop&q=60", // สวนฝรั่ง/ผลไม้
    "เมล่อน": "https://images.unsplash.com/photo-1571575179703-4bde44fb1421?w=600&auto=format&fit=crop&q=60" // เมล่อนในโรงเรือน
};

    filteredList.forEach(proj => {
        const card = document.createElement("div");
        const isSelected = selectedProjectId === proj.id;
        card.className = `portfolio-card glass-panel ${isSelected ? 'active-card' : ''}`;
        
        const areaVal = proj.kpis ? (proj.kpis.area || 0) : 0;
        const yieldVal = proj.kpis ? (proj.kpis.yieldIncrease || 0) : 0;
        const savedVal = proj.kpis ? (proj.kpis.resourceSaved || 0) : 0;
        
        // เลือกระหว่างรูปจริงที่แนบไว้ หรือรูป Default พืช
        const coverImg = proj.images?.after || proj.images?.before || defaultCropCovers[proj.crop] || defaultCropCovers["ข้าว"];

        card.innerHTML = `
            <div class="card-cover-container">
                <img src="${coverImg}" alt="${proj.crop}" class="card-cover-image" loading="lazy" />
                <div class="card-cover-overlay"></div>
                <div class="card-top-badges">
                    <span class="crop-badge crop-badge-${getCropClass(proj.crop)}">
                        <i data-lucide="${getCropIcon(proj.crop)}"></i> ${proj.crop}
                    </span>
                    <span class="card-badge-province">จ. ${proj.province}</span>
                </div>
                <div class="card-farmer-badge">
                    <i data-lucide="user"></i>
                    <span>${proj.farmerName || 'แปลงต้นแบบเกษตรกร'}</span>
                </div>
            </div>
            
            <div class="card-body-details">
                <div class="card-zoning-tag">
                    <i data-lucide="map-pin"></i>
                    <span>${proj.zoningSuitability || 'พื้นที่ดำเนินการแปลงต้นแบบ'}</span>
                </div>
                <h3 class="card-title">${proj.title}</h3>
                
                <div class="card-tech-used">
                    <i data-lucide="cpu"></i>
                    <span>${proj.technology}</span>
                </div>
                
                <p class="card-desc">${proj.context ? (proj.context.length > 90 ? proj.context.substring(0, 90) + "..." : proj.context) : ''}</p>
                
                <div class="card-metrics-row">
                    <div class="metric-col">
                        <span class="metric-col-val">${areaVal.toLocaleString()}</span>
                        <span class="metric-col-lbl">พื้นที่ (ไร่)</span>
                    </div>
                    <div class="metric-col">
                        <span class="metric-col-val metric-positive">+${yieldVal}%</span>
                        <span class="metric-col-lbl">ผลผลิตเพิ่ม</span>
                    </div>
                    <div class="metric-col">
                        <span class="metric-col-val metric-saving">${savedVal}%</span>
                        <span class="metric-col-lbl">ลดต้นทุน/น้ำ</span>
                    </div>
                </div>
            </div>
        `;

        card.addEventListener("click", () => {
            if (selectedProjectId === proj.id) {
                selectedProjectId = null;
            } else {
                selectedProjectId = proj.id;
                if (mapInstance && proj.coords) {
                    mapInstance.setView(proj.coords, 9);
                }
            }
            renderDashboard();
        });

        gridContainer.appendChild(card);
    });

    if (window.lucide) lucide.createIcons();
}

function downloadProjectReport() {
    if (selectedProjectId) {
        const proj = projectsData.find(p => p.id === selectedProjectId);
        if (proj && proj.docUrl) {
            window.open(proj.docUrl, '_blank');
            return;
        }
    }
    // หากอยู่ในหน้าภาพรวม ให้เปิดโฟลเดอร์ Google Drive รวมของโครงการทันที
    window.open("https://drive.google.com/drive/folders/1VVOteMQgWRj2iCnMMArr31vhWILyCWNp", '_blank');
}

function downloadInfographicAsImage() {
    if (selectedProjectId) {
        const proj = projectsData.find(p => p.id === selectedProjectId);
        if (proj && proj.infographicUrl) {
            window.open(proj.infographicUrl, '_blank');
            return;
        }
    }
    window.open("https://drive.google.com/drive/folders/1VVOteMQgWRj2iCnMMArr31vhWILyCWNp", '_blank');
}

function renderCalendar() {
    const calendarGridDays = document.getElementById("calendar-grid-days");
    if (!calendarGridDays) return;
    
    removeActiveTooltip();
    
    const year = calendarCurrentDate.getFullYear();
    const month = calendarCurrentDate.getMonth();
    
    const monthNamesThai = [
        "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
        "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ];
    
    const headerTitle = document.getElementById("calendar-month-year");
    if (headerTitle) {
        headerTitle.textContent = `${monthNamesThai[month]} ${year + 543}`;
    }
    
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    calendarGridDays.innerHTML = "";
    
    for (let i = 0; i < firstDayIndex; i++) {
        const emptyCell = document.createElement("div");
        emptyCell.className = "calendar-day-cell empty-day";
        calendarGridDays.appendChild(emptyCell);
    }
    
    const filteredProjects = getFilteredProjects();
    
    for (let i = 1; i <= totalDays; i++) {
        const dayCell = document.createElement("div");
        dayCell.className = "calendar-day-cell";
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        
        if (dateStr === selectedCalendarDate) {
            dayCell.classList.add("selected-day");
        }

        dayCell.style.cursor = "pointer";
        dayCell.addEventListener("click", () => {
            selectedCalendarDate = dateStr;
            renderCalendar();
        });
        
        const dayNumBadge = document.createElement("span");
        dayNumBadge.className = "day-number-badge";
        dayNumBadge.textContent = i;
        dayCell.appendChild(dayNumBadge);
        
        const eventsContainer = document.createElement("div");
        eventsContainer.className = "calendar-day-events";
        
        filteredProjects.forEach(proj => {
            if (proj.tasks && Array.isArray(proj.tasks)) {
                proj.tasks.forEach(task => {
                    if (task.date === dateStr) {
                        const eventTag = document.createElement("div");
                        eventTag.className = `calendar-event-tag event-crop-${getCropClass(proj.crop)}`;
                        eventTag.innerHTML = `<i data-lucide="${getCropIcon(proj.crop)}"></i> <span>${proj.province}</span>`;
                        
                        eventTag.setAttribute("data-task-title", task.title);
                        eventTag.setAttribute("data-task-desc", task.desc);
                        eventTag.setAttribute("data-task-assignee", `${task.assignee?.avatar || ''} ${task.assignee?.name || ''}`);
                        eventTag.setAttribute("data-task-priority", task.priority || 'low');
                        eventTag.setAttribute("data-project-title", proj.title);
                        eventTag.setAttribute("data-task-status", task.status);
                        
                        eventTag.addEventListener("mouseenter", showTooltip);
                        eventTag.addEventListener("mouseleave", removeActiveTooltip);
                        
                        eventsContainer.appendChild(eventTag);
                    }
                });
            }
        });
        
        dayCell.appendChild(eventsContainer);
        calendarGridDays.appendChild(dayCell);
    }

    renderSelectedDayTasks();
}

let activeTooltipEl = null;
function showTooltip(e) {
    removeActiveTooltip();
    
    const tag = e.target;
    const title = tag.getAttribute("data-task-title");
    const desc = tag.getAttribute("data-task-desc");
    const assignee = tag.getAttribute("data-task-assignee");
    const priority = tag.getAttribute("data-task-priority");
    const project = tag.getAttribute("data-project-title");
    const status = tag.getAttribute("data-task-status");
    
    const priorityText = priority === 'high' ? 'ด่วนที่สุด' : priority === 'medium' ? 'สำคัญ' : 'ทั่วไป';
    const statusText = status === 'done' ? 'เสร็จสิ้น' : status === 'in-progress' ? 'กำลังทำ' : 'วางแผน';
    
    const tooltip = document.createElement("div");
    tooltip.className = "calendar-event-tooltip";
    
    tooltip.innerHTML = `
        <div class="tooltip-title">${title}</div>
        <div style="font-size: 0.72rem; color: var(--color-secondary); font-weight: 600; margin-bottom: 6px; text-transform: uppercase;">
            ${project}
        </div>
        <div class="tooltip-desc">${desc}</div>
        <div class="tooltip-footer">
            <span>ผู้ทำงาน: ${assignee}</span>
        </div>
        <div class="tooltip-footer" style="margin-top: 4px;">
            <span>ความสำคัญ: ${priorityText}</span>
            <span>สถานะ: ${statusText}</span>
        </div>
    `;
    
    document.body.appendChild(tooltip);
    activeTooltipEl = tooltip;
    
    const rect = tag.getBoundingClientRect();
    const tooltipHeight = tooltip.offsetHeight;
    
    tooltip.style.left = `${rect.left + window.scrollX}px`;
    tooltip.style.top = `${rect.top + window.scrollY - tooltipHeight - 8}px`;
}

function removeActiveTooltip() {
    if (activeTooltipEl) {
        activeTooltipEl.remove();
        activeTooltipEl = null;
    }
}

function renderAreaProgress() {
    const progressGrid = document.getElementById("progress-grid-container");
    if (!progressGrid || typeof projectsData === 'undefined') return;

    progressGrid.innerHTML = "";

    projectsData.forEach(proj => {
        const tasks = proj.tasks || [];
        const totalTasks = tasks.length;
        const doneTasks = tasks.filter(t => t.status === "done").length;
        const percentage = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 100;

        const card = document.createElement("div");
        card.className = "progress-card";
        
        const isSelected = selectedProjectId === proj.id;
        if (isSelected) {
            card.style.borderColor = "var(--color-primary)";
            card.style.boxShadow = "var(--shadow-sm), 0 0 10px rgba(16, 185, 129, 0.15)";
        }

        card.style.cursor = "pointer";
        card.addEventListener("click", () => {
            if (selectedProjectId === proj.id) {
                selectedProjectId = null;
            } else {
                selectedProjectId = proj.id;
                if (mapInstance && proj.coords) {
                    mapInstance.setView(proj.coords, 9);
                }
            }
            renderDashboard();
        });

        card.innerHTML = `
            <div class="progress-card-header">
                <span class="progress-card-title">จ. ${proj.province}</span>
                <span class="progress-card-crop crop-badge-${getCropClass(proj.crop)}">
                    <i data-lucide="${getCropIcon(proj.crop)}"></i> ${proj.crop}
                </span>
            </div>
            <div class="progress-bar-container">
                <div class="progress-bar-fill" style="width: ${percentage}%"></div>
            </div>
            <div class="progress-card-footer">
                <span>ความก้าวหน้า</span>
                <span class="progress-percentage">${percentage}%</span>
            </div>
        `;
        progressGrid.appendChild(card);
    });

    if (window.lucide) lucide.createIcons();
}

function renderSelectedDayTasks() {
    const titleEl = document.getElementById("selected-date-title");
    const container = document.getElementById("daily-tasks-container");
    if (!container || !titleEl) return;

    container.innerHTML = "";

    const parts = selectedCalendarDate.split("-");
    if (parts.length === 3) {
        const y = parseInt(parts[0]);
        const m = parseInt(parts[1]) - 1;
        const d = parseInt(parts[2]);
        const monthNamesThai = [
            "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
            "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
        ];
        titleEl.textContent = `${d} ${monthNamesThai[m]} ${y + 543}`;
    }

    const filteredProjects = getFilteredProjects();
    let tasksFound = [];

    filteredProjects.forEach(proj => {
        if (proj.tasks && Array.isArray(proj.tasks)) {
            proj.tasks.forEach(task => {
                if (task.date === selectedCalendarDate) {
                    tasksFound.push({ task, proj });
                }
            });
        }
    });

    if (tasksFound.length === 0) {
        container.innerHTML = `
            <div class="daily-task-no-work">
                <i data-lucide="calendar-x" style="width: 32px; height: 32px;"></i>
                <p style="margin-top: 8px;">ไม่มีกิจกรรมหรือแผนงานในวันนี้</p>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
    }

    tasksFound.forEach(({ task, proj }) => {
        const item = document.createElement("div");
        item.className = "daily-task-item";
        
        let priorityLabel = task.priority === 'high' ? 'ด่วนที่สุด' : task.priority === 'medium' ? 'สำคัญ' : 'ทั่วไป';
        let statusLabel = task.status === 'done' ? 'เสร็จสิ้น' : task.status === 'in-progress' ? 'กำลังทำ' : 'วางแผน';
        let statusClass = task.status === 'done' ? 'done' : task.status === 'in-progress' ? 'inprogress' : 'planning';

        item.innerHTML = `
            <div class="daily-task-header">
                <span class="daily-task-project">
                    <span class="crop-badge crop-badge-${getCropClass(proj.crop)}">
                        <i data-lucide="${getCropIcon(proj.crop)}"></i> ${proj.crop}
                    </span>
                    <span>จ. ${proj.province}</span>
                </span>
                <span class="daily-task-status-badge status-badge-${statusClass}">${statusLabel}</span>
            </div>
            <div class="daily-task-title">${task.title}</div>
            <div class="daily-task-desc">${task.desc}</div>
            <div class="daily-task-footer">
                <div class="daily-task-assignee">
                    <span>${task.assignee?.avatar || '👨‍🌾'}</span>
                    <span>${task.assignee?.name || 'ทีมงาน'}</span>
                </div>
                <span class="task-priority priority-${task.priority || 'low'}">${priorityLabel}</span>
            </div>
        `;
        container.appendChild(item);
    });

    if (window.lucide) lucide.createIcons();
}

function getCropIcon(crop) {
    if (!crop) return "sprout";
    if (crop.includes("ข้าว")) return "sprout";
    if (crop.includes("ผำ")) return "sparkles";
    if (crop.includes("ทุเรียน")) return "crown";
    if (crop.includes("ไม้ดอก")) return "flower-2";
    if (crop.includes("ส้มโอ")) return "citrus";
    if (crop.includes("มะพร้าว")) return "palmtree";
    if (crop.includes("หอม")) return "layers";
    if (crop.includes("เมล่อน")) return "circle-dot";
    return "sprout";
}

function getCropClass(crop) {
    if (!crop) return "rice";
    if (crop.includes("ข้าว")) return "rice";
    if (crop.includes("ผำ")) return "palm";
    if (crop.includes("ทุเรียน")) return "durian";
    if (crop.includes("ไม้ดอก")) return "strawberry";
    if (crop.includes("ส้มโอ")) return "sugarcane";
    if (crop.includes("มะพร้าว")) return "palm";
    if (crop.includes("หอม")) return "durian";
    if (crop.includes("เมล่อน")) return "cassava";
    return "rice";
}

function formatDateThai(dateStr) {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
        const y = parseInt(parts[0]);
        const m = parseInt(parts[1]) - 1;
        const d = parseInt(parts[2]);
        const monthShortThai = [
            "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
            "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
        ];
        return `${d} ${monthShortThai[m]} ${y + 543}`;
    }
    return dateStr;
}