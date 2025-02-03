/*
  # Add Dementia-Friendly Features

  1. New Tables
    - `emergency_contacts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text)
      - `phone` (text)
      - `relationship` (text)
      - `created_at` (timestamptz)

    - `daily_routine`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `time` (time)
      - `activity` (text)
      - `notes` (text)
      - `created_at` (timestamptz)

    - `sos_alerts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `contact_id` (uuid, references emergency_contacts)
      - `latitude` (double precision)
      - `longitude` (double precision)
      - `status` (text)
      - `created_at` (timestamptz)

  2. Changes to Existing Tables
    - Add columns to `tasks`:
      - `repeat_pattern` (text)
      - `voice_reminder` (boolean)
      - `category` (text)

  3. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users
*/

-- Emergency Contacts Table
CREATE TABLE emergency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  phone text NOT NULL,
  relationship text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their emergency contacts"
  ON emergency_contacts
  USING (auth.uid() = user_id);

-- Daily Routine Table
CREATE TABLE daily_routine (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  time time NOT NULL,
  activity text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE daily_routine ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their daily routine"
  ON daily_routine
  USING (auth.uid() = user_id);

-- SOS Alerts Table
CREATE TABLE sos_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  contact_id uuid REFERENCES emergency_contacts NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  status text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sos_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their SOS alerts"
  ON sos_alerts
  USING (auth.uid() = user_id);

-- Add new columns to tasks table
ALTER TABLE tasks 
ADD COLUMN repeat_pattern text,
ADD COLUMN voice_reminder boolean DEFAULT true,
ADD COLUMN category text DEFAULT 'general';