import { AuthService } from './services/AuthService.js';
import { DashboardService } from './services/DashboardService.js';
import * as helpers from './utils/helpers.js';

class OnfireApp {
    constructor() {
        this.authService = new AuthService();
        this.dashboardService = new DashboardService();
        this.charts = {};
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupThemeToggle();
        
        // Directly show the dashboard page
        this.showDashboard();
    }

    setupEventListeners() {
        // Login form
        document.getElementById('loginForm').addEventListener('submit', this.handleLogin.bind(this));

        // Search functionality
        const searchInput = document.getElementById('searchInput');
        const debouncedSearch = helpers.debounce(this.handleSearch.bind(this), 300);
        searchInput.addEventListener('input', debouncedSearch);

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleFilter(e));
        });

        // Modal controls
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', () => this.closeAllModals());
        });

        // Add buttons
        document.getElementById('addEmployeeBtn').addEventListener('click', () => this.showModal('employeeModal'));
        document.getElementById('addProjectBtn').addEventListener('click', () => this.showModal('projectModal'));

        // Form submissions
        document.getElementById('employeeForm').addEventListener('submit', this.handleEmployeeSubmit.bind(this));
        document.getElementById('projectForm').addEventListener('submit', this.handleProjectSubmit.bind(this));

        // Export button
        document.getElementById('exportBtn').addEventListener('click', this.handleExport.bind(this));

        // Sign out button
        document.getElementById('signOutBtn').addEventListener('click', this.handleSignOut.bind(this));

        // Employee list item click
        document.getElementById('employeeList').addEventListener('click', (e) => {
            if (e.target.classList.contains('list-item-title')) {
                const employeeId = e.target.dataset.id;
                this.showEmployeeReport(employeeId);
            }
        });

        // Export employee data button
        document.getElementById('exportEmployeeBtn').addEventListener('click', this.handleExportEmployee.bind(this));

        // Edit and delete buttons
        document.getElementById('employeeList').addEventListener('click', (e) => {
            if (e.target.classList.contains('edit-btn')) {
                const employeeId = e.target.dataset.id;
                this.editEmployee(employeeId);
            } else if (e.target.classList.contains('delete-btn')) {
                const employeeId = e.target.dataset.id;
                this.deleteEmployee(employeeId);
            }
        });
    }

    setupThemeToggle() {
        const themeSwitch = document.getElementById('theme-switch');
        const currentTheme = localStorage.getItem('theme') || 'light';
        
        if (currentTheme === 'dark') {
            document.body.classList.add('dark-theme');
            themeSwitch.checked = true;
        }

        themeSwitch.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.body.classList.add('dark-theme');
                localStorage.setItem('theme', 'dark');
            } else {
                document.body.classList.remove('dark-theme');
                localStorage.setItem('theme', 'light');
            }
            this.updateCharts(); // Update chart themes
        });
    }

    async handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('emailInput').value;
        const password = document.getElementById('passwordInput').value;

        console.log('Login button pressed');
        console.log('Email:', email);
        console.log('Password:', password);

        try {
            const response = await this.authService.login(email, password);
            console.log('Login successful:', response);
            this.showDashboard();
        } catch (error) {
            console.error('Login failed:', error);
            helpers.AppError.handle(error);
        }
    }

    async handleSearch(e) {
        const query = e.target.value;
        const activeFilter = document.querySelector('.filter-btn.active').dataset.filter;
        
        try {
            const results = await this.dashboardService.search(query, activeFilter);
            this.updateSearchResults(results);
        } catch (error) {
            helpers.AppError.handle(error);
        }
    }

    handleFilter(e) {
        const buttons = document.querySelectorAll('.filter-btn');
        buttons.forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        
        // Trigger search with new filter
        const searchInput = document.getElementById('searchInput');
        if (searchInput.value) {
            this.handleSearch({ target: searchInput });
        }
    }

    async handleEmployeeSubmit(e) {
        e.preventDefault();
        const employeeId = e.target.dataset.id;
        const formData = {
            name: document.getElementById('employeeName').value,
            email: document.getElementById('employeeEmail').value,
            role: document.getElementById('employeeRole').value,
            skills: document.getElementById('employeeSkills').value.split(',').map(s => s.trim()),
            availability: document.getElementById('employeeAvailability').value
        };

        try {
            const validation = helpers.validateForm(formData, {
                name: { required: true },
                email: { required: true, email: true },
                role: { required: true }
            });

            if (!validation.isValid) {
                throw new helpers.AppError('Validation failed', 'validation', validation.errors);
            }

            if (employeeId) {
                await this.dashboardService.updateEmployee(employeeId, formData);
                this.showAlert('Employee updated successfully', 'success');
            } else {
                await this.dashboardService.addEmployee(formData);
                this.showAlert('Employee added successfully', 'success');
            }

            this.closeAllModals();
            this.updateDashboard();
        } catch (error) {
            helpers.AppError.handle(error);
        }
    }

    async handleProjectSubmit(e) {
        e.preventDefault();
        const projectId = e.target.dataset.id;
        const formData = {
            name: document.getElementById('projectName').value,
            description: document.getElementById('projectDescription').value,
            deadline: document.getElementById('projectDeadline').value,
            priority: document.getElementById('projectPriority').value,
            assignee: document.getElementById('projectAssignee').value,
            status: document.getElementById('projectStatus').value,
            tags: document.getElementById('projectTags').value.split(',').map(t => t.trim())
        };

        try {
            const validation = helpers.validateForm(formData, {
                name: { required: true },
                description: { required: true },
                deadline: { required: true },
                assignee: { required: true }
            });

            if (!validation.isValid) {
                throw new helpers.AppError('Validation failed', 'validation', validation.errors);
            }

            if (projectId) {
                await this.dashboardService.updateProject(projectId, formData);
                this.showAlert('Project updated successfully', 'success');
            } else {
                await this.dashboardService.addProject(formData);
                this.showAlert('Project added successfully', 'success');
            }

            this.closeAllModals();
            this.updateDashboard();
        } catch (error) {
            helpers.AppError.handle(error);
        }
    }

    async handleExport() {
        try {
            const data = await this.dashboardService.getDashboardSummary();
            const csvString = helpers.convertToCSV(data);
            const blob = new Blob([csvString], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `dashboard-export-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showAlert('Data exported successfully', 'success');
        } catch (error) {
            helpers.AppError.handle(error);
        }
    }

    async handleExportEmployee() {
        const employeeId = document.getElementById('employeeReportName').dataset.id;
        const employee = await this.dashboardService.getEmployeeById(employeeId);
        const csvString = helpers.convertToCSV([employee]);
        const blob = new Blob([csvString], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `employee-${employee.name}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showAlert('Employee data exported successfully', 'success');
    }

    handleSignOut() {
        this.authService.logout();
        this.showLoginPage();
    }

    showLoginPage() {
        document.getElementById('login-page').style.display = 'flex';
        document.getElementById('dashboard-page').style.display = 'none';
    }

    async showDashboard() {
        document.getElementById('login-page').style.display = 'none';
        document.getElementById('dashboard-page').style.display = 'block';
        await this.updateDashboard();
        
        // Subscribe to real-time updates
        this.dashboardService.subscribe((update) => {
            this.handleRealtimeUpdate(update);
        });
    }

    async showEmployeeReport(employeeId) {
        const employee = await this.dashboardService.getEmployeeById(employeeId);
        document.getElementById('employeeReportName').textContent = employee.name;
        document.getElementById('employeeReportEmail').textContent = employee.email;
        document.getElementById('employeeReportRole').textContent = employee.role;
        document.getElementById('employeeReportSkills').textContent = employee.skills.join(', ');
        document.getElementById('employeeReportAvailability').textContent = employee.availability;

        document.getElementById('dashboard-page').style.display = 'none';
        document.getElementById('employee-report-page').style.display = 'block';
    }

    async updateDashboard() {
        try {
            const data = await this.dashboardService.getDashboardSummary();
            
            // Update statistics
            document.getElementById('totalProjects').textContent = data.totalProjects;
            document.getElementById('activeProjects').textContent = data.activeProjects;
            document.getElementById('completedProjects').textContent = data.completedProjects;
            
            // Update charts
            this.updateCharts(data);
            
            // Update employee and project lists
            await this.updateLists();

            // Generate alerts for overdue tasks
            this.generateAlerts(data);
        } catch (error) {
            helpers.AppError.handle(error);
        }
    }

    updateCharts(data) {
        // Update project status chart
        this.updateProjectStatusChart(data.projectsByStatus);
        
        // Update employee workload chart
        this.updateEmployeeWorkloadChart(data.employeeWorkload);
        
        // Update project trends chart
        this.updateProjectTrendChart(data.projectTrends);
    }

    updateProjectStatusChart(data) {
        const ctx = document.getElementById('projectStatusChart').getContext('2d');
        
        if (this.charts.projectStatus) {
            this.charts.projectStatus.destroy();
        }
        
        this.charts.projectStatus = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(data),
                datasets: [{
                    data: Object.values(data),
                    backgroundColor: helpers.generateChartColors(Object.keys(data).length)
                }]
            },
            options: helpers.chartPresets.doughnut
        });
    }

    updateEmployeeWorkloadChart(data) {
        const ctx = document.getElementById('employeeWorkloadChart').getContext('2d');
        
        if (this.charts.employeeWorkload) {
            this.charts.employeeWorkload.destroy();
        }
        
        this.charts.employeeWorkload = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(d => d.name),
                datasets: [{
                    label: 'Assigned Projects',
                    data: data.map(d => d.projectCount),
                    backgroundColor: helpers.generateChartColors(1)[0]
                }]
            },
            options: helpers.chartPresets.bar
        });
    }

    updateProjectTrendChart(data) {
        const ctx = document.getElementById('projectTrendChart').getContext('2d');
        
        if (this.charts.projectTrend) {
            this.charts.projectTrend.destroy();
        }
        
        this.charts.projectTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [
                    {
                        label: 'Completed Projects',
                        data: data.completed,
                        borderColor: helpers.getStatusColor('Completed'),
                        fill: false
                    },
                    {
                        label: 'New Projects',
                        data: data.new,
                        borderColor: helpers.getStatusColor('Not Started'),
                        fill: false
                    }
                ]
            },
            options: helpers.chartPresets.line
        });
    }

    async updateLists() {
        const employees = await this.dashboardService.getEmployees();
        const projects = await this.dashboardService.getProjects();
        
        this.updateEmployeeList(employees);
        this.updateProjectList(projects);
        this.updateProjectTimeline(projects);
    }

    updateEmployeeList(employees) {
        const container = document.getElementById('employeeList');
        container.innerHTML = employees.map(employee => `
            <div class="list-item">
                <div class="list-item-header">
                    <h3 class="list-item-title" data-id="${employee.id}">${employee.name}</h3>
                    <div class="list-item-actions">
                        <button class="btn btn-sm edit-btn" data-id="${employee.id}">Edit</button>
                        <button class="btn btn-sm btn-danger delete-btn" data-id="${employee.id}">Remove</button>
                    </div>
                </div>
                <div class="employee-details">
                    <p><strong>Role:</strong> ${employee.role}</p>
                    <p><strong>Skills:</strong> ${employee.skills.join(', ')}</p>
                    <p><strong>Availability:</strong> ${employee.availability}</p>
                </div>
            </div>
        `).join('');
    }

    updateProjectList(projects) {
        const container = document.getElementById('projectList');
        container.innerHTML = projects.map(project => `
            <div class="list-item">
                <div class="list-item-header">
                    <h3 class="list-item-title">${project.name}</h3>
                    <div class="list-item-actions">
                        <button class="btn btn-sm" onclick="app.editProject(${project.id})">Edit</button>
                    </div>
                </div>
                <div class="project-details">
                    <p><strong>Status:</strong> <span class="status-badge" style="background-color: ${helpers.getStatusColor(project.status)}">${project.status}</span></p>
                    <p><strong>Deadline:</strong> ${helpers.formatDate(project.deadline)}</p>
                    <p><strong>Assignee:</strong> ${project.assignee}</p>
                    <p><strong>Priority:</strong> <span class="priority-badge ${helpers.getPriorityBadge(project.priority).class}">${project.priority}</span></p>
                </div>
            </div>
        `).join('');
    }

    updateProjectTimeline(projects) {
        const container = document.getElementById('projectTimeline');
        const sortedProjects = [...projects].sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
        
        container.innerHTML = `
            <div class="timeline">
                ${sortedProjects.map(project => `
                    <div class="timeline-item">
                        <div class="timeline-date">${helpers.formatDate(project.deadline)}</div>
                        <div class="timeline-content">
                            <h4>${project.name}</h4>
                            <p>${project.status}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } 

    updateSearchResults(results) {
        const activeFilter = document.querySelector('.filter-btn.active').dataset.filter;
        
        if (activeFilter === 'all' || activeFilter === 'employees') {
            this.updateEmployeeList(results.employees);
        }
        
        if (activeFilter === 'all' || activeFilter === 'projects') {
            this.updateProjectList(results.projects);
        }
    }

    handleRealtimeUpdate(update) {
        switch (update.type) {
            case 'project_added':
            case 'project_updated':
            case 'employee_added':
            case 'employee_updated':
            case 'employee_removed':
                this.updateDashboard();
                break;
        }
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        helpers.animate.fadeIn(modal);
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            helpers.animate.fadeOut(modal);
        });
    }

    showAlert(message, type = 'success') {
        const alertContainer = document.getElementById('alertContainer');
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.textContent = message;
        
        alertContainer.appendChild(alert);
        helpers.animate.slideIn(alert);
        
        setTimeout(() => {
            helpers.animate.fadeOut(alert);
            setTimeout(() => alert.remove(), 300);
        }, 5000);
    }

    async removeEmployee(employeeId) {
        try {
            await this.dashboardService.removeEmployee(employeeId);
            this.updateDashboard();
            this.showAlert('Employee removed successfully', 'success');
        } catch (error) {
            helpers.AppError.handle(error);
        }
    }

    async editEmployee(employeeId) {
        const employee = await this.dashboardService.getEmployeeById(employeeId);
        document.getElementById('employeeName').value = employee.name;
        document.getElementById('employeeEmail').value = employee.email;
        document.getElementById('employeeRole').value = employee.role;
        document.getElementById('employeeSkills').value = employee.skills.join(', ');
        document.getElementById('employeeAvailability').value = employee.availability;
        document.getElementById('employeeForm').dataset.id = employeeId;
        this.showModal('employeeModal');
    }

    async deleteEmployee(employeeId) {
        try {
            await this.dashboardService.removeEmployee(employeeId);
            this.updateDashboard();
            this.showAlert('Employee removed successfully', 'success');
        } catch (error) {
            helpers.AppError.handle(error);
        }
    }

    generateAlerts(data) {
        const now = new Date();
        data.projects.forEach(project => {
            const deadline = new Date(project.deadline);
            if (deadline < now && project.status !== 'Completed') {
                this.showAlert(`Project "${project.name}" is overdue!`, 'danger');
            } else if ((deadline - now) / (1000 * 60 * 60 * 24) <= 7) {
                this.showAlert(`Project "${project.name}" is nearing its deadline!`, 'warning');
            }
        });
    }
}

// Initialize the app
const app = new OnfireApp();
window.app = app; // Make app accessible globally for event handlers