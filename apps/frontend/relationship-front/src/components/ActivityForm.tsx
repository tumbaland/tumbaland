import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Box,
  Alert,
  CircularProgress,
  Typography,
} from "@mui/material";
import { Activity, ActivityType, CreateActivityRequest } from "../api/types";
import { useActivityTypes } from "../hooks/useActivities";
import {
  ACTIVITY_CONFIG,
  formatDateForInput,
  validateActivity,
} from "../utils/activityUtils";

interface ActivityFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateActivityRequest) => Promise<boolean>;
  activity?: Activity | null;
  title?: string;
}

const ActivityForm: React.FC<ActivityFormProps> = ({
  open,
  onClose,
  onSubmit,
  activity,
  title,
}) => {
  const { types: availableTypes, loading: typesLoading } = useActivityTypes();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  // Form state
  const [formData, setFormData] = useState({
    date: "",
    hours: 0,
    activityType: "" as ActivityType,
    description: "",
  });

  // Initialize form data when dialog opens or activity changes
  useEffect(() => {
    if (open) {
      if (activity) {
        // Edit mode - populate with existing data
        setFormData({
          date: formatDateForInput(activity.date),
          hours: activity.hours,
          activityType: activity.activity.type,
          description: activity.activity.description || "",
        });
      } else {
        // Create mode - set defaults
        setFormData({
          date: formatDateForInput(new Date()),
          hours: 1,
          activityType: "" as ActivityType,
          description: "",
        });
      }
      setErrors([]);
    }
  }, [activity, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const activityData: CreateActivityRequest = {
      date: formData.date,
      ...(formData.hours > 0 && { hours: formData.hours }),
      activity: {
        type: formData.activityType,
        ...(formData.description.trim() && {
          description: formData.description.trim(),
        }),
      },
    };

    // Validate
    const validationErrors = validateActivity(activityData);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    setErrors([]);

    try {
      const success = await onSubmit(activityData);
      if (success) {
        onClose();
      }
    } catch (error: any) {
      setErrors([error.message || "Failed to save activity"]);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  const isEditMode = !!activity;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        component: "form",
        onSubmit: handleSubmit,
      }}
    >
      <DialogTitle>
        {title || (isEditMode ? "Edit Activity" : "Add New Activity")}
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3, pt: 1 }}>
          {errors.length > 0 && (
            <Alert severity="error">
              <ul style={{ margin: 0, paddingLeft: "20px" }}>
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </Alert>
          )}
          <TextField
            label="Date"
            type="text"
            value={(() => {
              if (!formData.date) return '';
              const d = new Date(formData.date);
              const day = String(d.getDate()).padStart(2, '0');
              const month = String(d.getMonth() + 1).padStart(2, '0');
              const year = d.getFullYear();
              return `${day}.${month}.${year}`;
            })()}
            onChange={(e) => {
              // Parse DD.MM.YYYY to ISO string
              const [day, month, year] = e.target.value.split('.')
              let iso = '';
              if (day && month && year) {
                iso = new Date(`${year}-${month}-${day}`).toISOString().slice(0, 10);
              }
              setFormData((prev) => ({ ...prev, date: iso }));
            }}
            fullWidth
            required
            InputLabelProps={{ shrink: true }}
            placeholder="DD.MM.YYYY"
          />{" "}
          <TextField
            label="Duration (hours) - Optional"
            type="number"
            value={formData.hours}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                hours: parseInt(e.target.value) || 0,
              }))
            }
            fullWidth
          />
          <TextField
            label="Activity Type"
            select
            value={formData.activityType}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                activityType: e.target.value as ActivityType,
              }))
            }
            fullWidth
            required
            disabled={typesLoading}
          >
            {typesLoading ? (
              <MenuItem disabled>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                Loading types...
              </MenuItem>
            ) : (
              availableTypes.map((type) => (
                <MenuItem key={type} value={type}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography component="span">
                      {ACTIVITY_CONFIG[type]?.icon || "✨"}
                    </Typography>
                    {ACTIVITY_CONFIG[type]?.label || type}
                  </Box>
                </MenuItem>
              ))
            )}
          </TextField>{" "}
          <TextField
            label="Description - Optional"
            multiline
            rows={3}
            value={formData.description}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, description: e.target.value }))
            }
            fullWidth
            inputProps={{ maxLength: 500 }}
            helperText={`${formData.description.length}/500 characters`}
          />
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={loading || typesLoading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {loading ? "Saving..." : isEditMode ? "Update" : "Create"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ActivityForm;
