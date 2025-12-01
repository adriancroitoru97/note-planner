import axios from 'axios';

// Configure your backend base URL
const API_BASE_URL = 'http://localhost:8080';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1/notes`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to attach authentication token
apiClient.interceptors.request.use(
  (config) => {
    // Get token from localStorage with key 'token'
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

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized - redirect to login
      console.error('Unauthorized access - please login again');
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Type definitions matching your backend DTOs
export type NotePrivacy = 'PUBLIC' | 'PRIVATE' | 'COLLABORATORS';

export interface NoteDto {
  id: number;
  title: string;
  text: string;
  privacy: NotePrivacy;
  authorId: number;
  sharedWithUserIds: number[];
}

export interface CreateNoteRequest {
  title: string;
  text: string;
  privacy: NotePrivacy;
  sharedWithUserIds?: number[]; // Only relevant if privacy = PRIVATE
}

export interface UpdateNoteRequest {
  title?: string;
  text?: string;
  privacy?: NotePrivacy;
  sharedWithUserIds?: number[];
}

// API service methods
export const notesApi = {
  // Create a new note
  createNote: async (request: CreateNoteRequest): Promise<NoteDto> => {
    const response = await apiClient.post<NoteDto>('/createNote', request);
    return response.data;
  },

  // Get a single note by ID
  getNote: async (id: number): Promise<NoteDto> => {
    const response = await apiClient.get<NoteDto>(`/getNote/${id}`);
    return response.data;
  },

  // Get all visible notes (public + shared + own)
  getAllVisibleNotes: async (): Promise<NoteDto[]> => {
    const response = await apiClient.get<NoteDto[]>('/getAllVisibleNotes');
    return response.data;
  },

  // Get only my notes
  getMyNotes: async (): Promise<NoteDto[]> => {
    const response = await apiClient.get<NoteDto[]>('/getMyNotes');
    return response.data;
  },

  // Update an existing note
  updateNote: async (id: number, request: UpdateNoteRequest): Promise<NoteDto> => {
    const response = await apiClient.put<NoteDto>(`/updateNote/${id}`, request);
    return response.data;
  },

  // Delete a note
  deleteNote: async (id: number): Promise<void> => {
    await apiClient.delete(`/deleteNote/${id}`);
  },
};

export default notesApi;