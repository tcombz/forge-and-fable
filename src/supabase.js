import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://gzeftiuvfjcjvsfsefha.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6ZWZ0aXV2ZmpjanZzZnNlZmhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxODQwNDgsImV4cCI6MjA4ODc2MDA0OH0.O9rNZZZEF05DueQd79EBl_LUq6SR3f9FSEK8qEZ98Yg'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)