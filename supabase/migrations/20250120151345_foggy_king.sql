/*
  # Add Location Bookmarks

  1. New Tables
    - `location_bookmarks`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text) - name of the bookmark (e.g., "Home", "Work")
      - `latitude` (double precision)
      - `longitude` (double precision)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `location_bookmarks` table
    - Add policies for CRUD operations
*/

CREATE TABLE location_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE location_bookmarks ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to insert their own bookmarks
CREATE POLICY "Users can insert their own bookmarks"
  ON location_bookmarks
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy to allow users to view their own bookmarks
CREATE POLICY "Users can view their own bookmarks"
  ON location_bookmarks
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy to allow users to update their own bookmarks
CREATE POLICY "Users can update their own bookmarks"
  ON location_bookmarks
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy to allow users to delete their own bookmarks
CREATE POLICY "Users can delete their own bookmarks"
  ON location_bookmarks
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);