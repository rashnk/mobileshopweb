
const { createApp } = Vue;
localApi = 'http://127.0.0.1:5001/shopmgr-fea0d/us-central1/apiDev/servicebook';
devApi = 'https://us-central1-shopmgr-fea0d.cloudfunctions.net/apiDev/servicebook'
prodApi = 'https://us-central1-shopmgr-fea0d.cloudfunctions.net/api/servicebook'

// use prodapi when github.io in url
// use localApi when localhost or 127.0.0.1 in url
// use devApi otherwise
let apiBaseUrlforEnv = devApi;
if (window.location.href.includes('github.io')) {
    apiBaseUrlforEnv = prodApi;
} else if (window.location.href.includes('localhost') || window.location.href.includes('127.0.0.1')) {
    apiBaseUrlforEnv = localApi;
}

createApp({
    data() {
        return {
            // Authentication
            isLoggedIn: false,
            currentUser: null,
            loginForm: {
                username: '',
                password: ''
            },
            loginError: '',
            isLoggingIn: false,

            // API Base URL
            apiBaseUrl: apiBaseUrlforEnv,
            // UI State
            activeTab: 'customers',
            loading: false,
            searchQuery: '',
            filterWithDue: false,
            dueStatusFilter: 'delivered,completed',

            // Data
            customers: [],
            filteredCustomers: [],
            allServices: [],
            summary: {
                totalRevenue: 0,
                totalCollected: 0,
                totalPending: 0,
                totalServices: 0,
                completedServices: 0,
                deliveredServices: 0
            },

            // Modals
            showCustomerModal: false,
            selectedCustomer: null,
            customerServices: { services: [], totals: {} },

            showPaymentModal: false,
            selectedService: null,
            paymentForm: {
                paidAmount: 0,
                notes: ''
            },
            paymentError: '',
            paymentSuccess: '',
            isUpdatingPayment: false
        }
    },

    mounted() {
        this.checkExistingLogin();
    },

    methods: {
        // Generate domain-based salt to prevent cross-domain localStorage usage
        getDomainSalt() {
            const domain = window.location.hostname || 'localhost';
            // Create a simple hash from domain for salt
            let hash = 0;
            for (let i = 0; i < domain.length; i++) {
                const char = domain.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32bit integer
            }
            // Use absolute value and ensure it's between 1-10 for character shift
            return Math.abs(hash % 10) + 1;
        },

        // Simple encryption/decryption for localStorage with domain-based salt
        encrypt(text) {
            if (!text) return '';
            const salt = this.getDomainSalt();
            // Apply domain salt + base shift
            const shifted = text.split('').map(char => 
                String.fromCharCode(char.charCodeAt(0) + 3 + salt)
            ).join('');
            return btoa(shifted);
        },

        decrypt(encryptedText) {
            if (!encryptedText) return '';
            try {
                const salt = this.getDomainSalt();
                const decoded = atob(encryptedText);
                return decoded.split('').map(char => 
                    String.fromCharCode(char.charCodeAt(0) - 3 - salt)
                ).join('');
            } catch (error) {
                console.error('Decryption failed:', error);
                return '';
            }
        },

        // Authentication Methods
        async login() {
            this.isLoggingIn = true;
            this.loginError = '';

            try {
                const response = await fetch(`${this.apiBaseUrl}/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(this.loginForm)
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    this.isLoggedIn = true;
                    this.currentUser = data.user;
                    localStorage.setItem('serviceBookAuth', JSON.stringify({
                        user: data.user,
                        credentials: {
                            username: this.loginForm.username,
                            password: this.encrypt(this.loginForm.password)
                        }
                    }));
                    this.loadInitialData();
                } else {
                    this.loginError = data.message || 'Login failed';
                }
            } catch (error) {
                this.loginError = 'Network error. Please try again.';
                console.error('Login error:', error);
            } finally {
                this.isLoggingIn = false;
            }
        },

        logout() {
            this.isLoggedIn = false;
            this.currentUser = null;
            localStorage.removeItem('serviceBookAuth');
            this.resetData();
        },

        checkExistingLogin() {
            const auth = localStorage.getItem('serviceBookAuth');
            if (auth) {
                try {
                    const authData = JSON.parse(auth);
                    this.isLoggedIn = true;
                    this.currentUser = authData.user;
                    this.loginForm.username = authData.credentials.username;
                    this.loginForm.password = this.decrypt(authData.credentials.password);
                    this.loadInitialData();
                } catch (error) {
                    localStorage.removeItem('serviceBookAuth');
                }
            }
        },

        getAuthHeaders() {
            return {
                'Content-Type': 'application/json',
                'username': this.loginForm.username,
                'password': this.loginForm.password
            };
        },

        // Data Loading Methods
        async loadInitialData() {
            this.loading = true;
            try {
                await Promise.all([
                    this.loadCustomers(),
                    this.loadAllServices(),
                    this.loadSummary()
                ]);
            } catch (error) {
                console.error('Error loading initial data:', error);
            } finally {
                this.loading = false;
            }
        },

        async loadCustomers() {
            try {
                let url = `${this.apiBaseUrl}/customers`;
                const params = new URLSearchParams();

                if (this.filterWithDue) {
                    params.append('withDue', 'true');
                }

                if (this.dueStatusFilter) {
                    params.append('status', this.dueStatusFilter);
                }

                if (params.toString()) {
                    url += `?${params.toString()}`;
                }

                const response = await fetch(url, {
                    headers: this.getAuthHeaders()
                });
                const data = await response.json();
                this.customers = data;
                this.filteredCustomers = data;
            } catch (error) {
                console.error('Error loading customers:', error);
            }
        },

        async loadAllServices() {
            try {
                // Load services from the main services endpoint
                const response = await fetch(`${this.apiBaseUrl.replace('/servicebook', '/services')}`, {
                    headers: this.getAuthHeaders()
                });
                const data = await response.json();
                this.allServices = data;
            } catch (error) {
                console.error('Error loading services:', error);
            }
        },

        async loadSummary() {
            try {
                const response = await fetch(`${this.apiBaseUrl}/summary`, {
                    headers: this.getAuthHeaders()
                });
                const data = await response.json();
                this.summary = data;
            } catch (error) {
                console.error('Error loading summary:', error);
            }
        },

        async searchCustomers() {
            if (!this.searchQuery.trim()) {
                this.filteredCustomers = this.customers;
                return;
            }

            try {
                let url = `${this.apiBaseUrl}/search/customers`;
                const params = new URLSearchParams();
                params.append('query', this.searchQuery);

                if (this.filterWithDue) {
                    params.append('withDue', 'true');
                }

                if (this.dueStatusFilter) {
                    params.append('status', this.dueStatusFilter);
                }

                url += `?${params.toString()}`;

                const response = await fetch(url, {
                    headers: this.getAuthHeaders()
                });
                const data = await response.json();
                this.filteredCustomers = data;
            } catch (error) {
                console.error('Error searching customers:', error);
                this.filteredCustomers = this.customers.filter(customer =>
                    customer.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
                    customer.phone.includes(this.searchQuery) ||
                    (customer.email && customer.email.toLowerCase().includes(this.searchQuery.toLowerCase()))
                );
            }
        },

        // New methods for search and filtering
        async performSearch() {
            this.loading = true;
            try {
                await this.searchCustomers();
            } finally {
                this.loading = false;
            }
        },

        async clearSearch() {
            this.searchQuery = '';
            this.filterWithDue = false;
            this.dueStatusFilter = 'delivered,completed';
            await this.loadCustomers();
        },

        async applyFilters() {
            this.loading = true;
            try {
                if (this.searchQuery.trim()) {
                    await this.searchCustomers();
                } else {
                    await this.loadCustomers();
                }
            } finally {
                this.loading = false;
            }
        },

        // Modal Methods
        async viewCustomerServices(customer) {
            this.selectedCustomer = customer;
            this.showCustomerModal = true;

            try {
                const response = await fetch(`${this.apiBaseUrl}/customers/${customer.id}/services`, {
                    headers: this.getAuthHeaders()
                });
                const data = await response.json();
                this.customerServices = data;
            } catch (error) {
                console.error('Error loading customer services:', error);
            }
        },

        closeCustomerModal() {
            this.showCustomerModal = false;
            this.selectedCustomer = null;
            this.customerServices = { services: [], totals: {} };
        },

        updatePayment(service) {
            this.selectedService = service;
            this.paymentForm.paidAmount = service.paidAmount || 0;
            this.paymentForm.notes = '';
            this.paymentError = '';
            this.paymentSuccess = '';
            this.showPaymentModal = true;
        },

        closePaymentModal() {
            this.showPaymentModal = false;
            this.selectedService = null;
            this.paymentForm = { paidAmount: 0, notes: '' };
            this.paymentError = '';
            this.paymentSuccess = '';
        },

        async submitPayment() {
            this.isUpdatingPayment = true;
            this.paymentError = '';
            this.paymentSuccess = '';

            try {
                const response = await fetch(`${this.apiBaseUrl}/services/${this.selectedService.id}/payment`, {
                    method: 'PATCH',
                    headers: this.getAuthHeaders(),
                    body: JSON.stringify(this.paymentForm)
                });

                const data = await response.json();

                if (response.ok) {
                    this.paymentSuccess = 'Payment updated successfully!';

                    // Refresh data
                    await this.loadInitialData();

                    // If we're viewing customer services, refresh that too
                    if (this.showCustomerModal && this.selectedCustomer) {
                        const customerResponse = await fetch(`${this.apiBaseUrl}/customers/${this.selectedCustomer.id}/services`, {
                            headers: this.getAuthHeaders()
                        });
                        const customerData = await customerResponse.json();
                        this.customerServices = customerData;
                    }

                    setTimeout(() => {
                        this.closePaymentModal();
                    }, 1500);
                } else {
                    this.paymentError = data.message || 'Failed to update payment';
                }
            } catch (error) {
                this.paymentError = 'Network error. Please try again.';
                console.error('Payment update error:', error);
            } finally {
                this.isUpdatingPayment = false;
            }
        },

        async viewServiceDetails(service) {
            try {
                const response = await fetch(`${this.apiBaseUrl}/services/${service.id}`, {
                    headers: this.getAuthHeaders()
                });
                const data = await response.json();
                // For now, just show payment modal
                this.updatePayment(data);
            } catch (error) {
                console.error('Error loading service details:', error);
            }
        },

        // Utility Methods
        formatAmount(amount) {
            if (typeof amount !== 'number') return '0.00';
            return amount.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        },

        formatDate(dateString) {
            if (!dateString) return '';
            try {
                const date = new Date(dateString);
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = String(date.getFullYear()).slice(-2);
                return `${day}-${month}-${year}`;
            } catch (error) {
                return dateString;
            }
        },

        getBalanceAmount(service) {
            const finalCost = service.finalCost || 0;
            const paidAmount = service.paidAmount || 0;
            return Math.max(0, finalCost - paidAmount);
        },

        getServiceFinalCost(service) {
            return service.paymentDetails?.finalCost || service.finalCost || 0;
        },

        getPaymentStatus(service) {
            const balance = this.getBalanceAmount(service);
            const paid = service.paidAmount || 0;

            if (balance === 0) return 'paid';
            if (paid === 0) return 'unpaid';
            return 'partial';
        },

        resetData() {
            this.customers = [];
            this.filteredCustomers = [];
            this.allServices = [];
            this.summary = {
                totalRevenue: 0,
                totalCollected: 0,
                totalPending: 0,
                totalServices: 0,
                completedServices: 0,
                deliveredServices: 0
            };
            this.searchQuery = '';
            this.filterWithDue = false;
            this.dueStatusFilter = 'delivered,completed';
            this.activeTab = 'customers';
        }
    }
}).mount('#app');
