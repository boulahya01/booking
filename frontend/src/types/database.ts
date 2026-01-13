export type Profile = {
    id: string;
    student_id: string;
    full_name: string;
    role: 'student' | 'admin' | 'moderator';
    status: 'pending' | 'approved' | 'rejected' | 'suspended';
    created_at: string;
    updated_at: string;
};

export type Pitch = {
    id: string;
    name: string;
    location: string;
    capacity: number;
    open_time: string; // Time in "HH:MM" format (e.g., "08:00")
    close_time: string; // Time in "HH:MM" format (e.g., "22:00")
    sort_order?: number; // Manual sort order (1-n)
    created_at: string;
};

export type Slot = {
    id: string;
    pitch_id: string;
    datetime_start: string;
    datetime_end: string;
    capacity: number;
    is_available: boolean;
    created_at: string;
};

export type Booking = {
    id: string;
    user_id: string;
    slot_id?: string;
    pitch_id?: string;
    slot_datetime?: string;
    status: 'active' | 'cancelled' | 'completed';
    created_at: string;
    updated_at?: string;
};
