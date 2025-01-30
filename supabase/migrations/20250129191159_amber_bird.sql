/*
  # Add reminder functionality to tasks

  1. Changes
    - Add reminder_time column to tasks table
    - Add reminder_sent column to track notification status
*/

ALTER TABLE tasks 
ADD COLUMN reminder_time timestamptz,
ADD COLUMN reminder_sent boolean DEFAULT false;