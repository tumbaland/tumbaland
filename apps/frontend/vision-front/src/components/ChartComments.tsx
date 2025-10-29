import React, { useState } from 'react';
import {
  IconButton,
  Badge,
  Drawer,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Button
} from '@mui/material';
import { Comment as CommentIcon, Close as CloseIcon } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import CommentForm from './CommentForm';
import CommentItem from './CommentItem';
import { commentService } from '../services/commentService';
import { Comment } from '../types';

interface ChartCommentsProps {
  trainingId: string;
  section: string; // e.g., 'iou_chart', 'loss_chart', 'precision_chart', etc.
  position?: 'top-right' | 'bottom-right' | 'inline';
}

const ChartComments: React.FC<ChartCommentsProps> = ({
  trainingId,
  section,
  position = 'top-right'
}) => {
  const [showComments, setShowComments] = useState(false);
  const [showAddComment, setShowAddComment] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['comments', trainingId, section],
    queryFn: () => commentService.getCommentsByTraining(trainingId, section),
    enabled: !!trainingId
  });

  const comments = data?.data?.comments || [];
  
  // Recursively count all comments including replies
  const countTotalComments = (comments: any[]): number => {
    return comments.reduce((total, comment) => {
      let count = 1; // Count the comment itself
      if (comment.replies && comment.replies.length > 0) {
        count += countTotalComments(comment.replies);
      }
      return total + count;
    }, 0);
  };
  
  const commentCount = countTotalComments(comments);

  const handleCommentAdded = () => {
    // Refetch the comments query after a short delay to ensure DB write is complete
    setTimeout(() => {
      refetch();
    }, 500);
    // Hide the add comment form after adding a comment
    setShowAddComment(false);
  };

  const handleCommentUpdated = () => {
    // Refetch the comments query
    refetch();
  };

  const handleOpenComments = () => {
    setShowComments(true);
    // Refetch comments when opening the dialog to ensure fresh data
    refetch();
  };

  const positionStyles = {
    'top-right': {
      position: 'absolute',
      top: 8,
      right: 8,
      zIndex: 10
    },
    'bottom-right': {
      position: 'absolute',
      bottom: 8,
      right: 8,
      zIndex: 10
    },
    'inline': {
      display: 'inline-flex',
      alignItems: 'center',
      ml: 1
    }
  };

  const CommentButton = () => (
    <Box sx={positionStyles[position]}>
      <IconButton
        size="small"
        onClick={handleOpenComments}
        sx={{
          bgcolor: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(4px)',
          border: '1px solid rgba(0, 0, 0, 0.12)',
          '&:hover': {
            bgcolor: 'rgba(255, 255, 255, 1)',
          }
        }}
      >
        <Badge 
          badgeContent={commentCount} 
          color="primary" 
          max={99}
          showZero={true}
        >
          <CommentIcon fontSize="small" />
        </Badge>
      </IconButton>
    </Box>
  );

  return (
    <>
      <CommentButton />

      {/* Comments Drawer */}
      <Drawer
        anchor="right"
        open={showComments}
        onClose={() => setShowComments(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: '400px',
            p: 0
          }
        }}
      >
        {/* Drawer Header */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              Comments - {section.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </Typography>
            <IconButton onClick={() => setShowComments(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Drawer Content */}
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Comments List */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : error ? (
              <Alert severity="error">
                {error instanceof Error ? error.message : 'Failed to load comments'}
              </Alert>
            ) : comments.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  No comments yet. Be the first to comment on this chart.
                </Typography>
                {!showAddComment && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setShowAddComment(true)}
                  >
                    Add First Comment
                  </Button>
                )}
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {comments.map((comment: Comment) => (
                  <CommentItem
                    key={comment._id}
                    comment={comment}
                    trainingId={trainingId}
                    onCommentUpdated={handleCommentUpdated}
                  />
                ))}
              </Box>
            )}
          </Box>

          {/* Add Comment Form */}
          {showAddComment && (
            <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
              <CommentForm
                trainingId={trainingId}
                section={section}
                onCommentAdded={handleCommentAdded}
                placeholder={`Add a comment about the ${section.replace('_', ' ')}...`}
                buttonText="Add Comment"
              />
            </Box>
          )}

          {/* Add Comment Toggle Button */}
          {!showAddComment && comments.length > 0 && (
            <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => setShowAddComment(true)}
              >
                Add Comment
              </Button>
            </Box>
          )}
        </Box>
      </Drawer>
    </>
  );
};

export default ChartComments;