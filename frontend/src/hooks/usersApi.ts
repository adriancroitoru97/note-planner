import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080';

// Create axios instance for user API
const userApiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1/users`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to attach authentication token
userApiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export interface UserDto {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  role?: string;
}

// API service methods
export const usersApi = {
  // Get current user info
  getCurrentUser: async (): Promise<UserDto> => {
    const response = await userApiClient.get<UserDto>('/me');
    return response.data;
  },

  // Get user by ID
  getUserById: async (id: number): Promise<UserDto> => {
    const response = await userApiClient.get<UserDto>(`/getUser/${id}`);
    return response.data;
  },

  getAllUsers: async (): Promise<UserDto[]> => {
    const response = await userApiClient.get<UserDto[]>(`/all`);
    return response.data;
  },
};
