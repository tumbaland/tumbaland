import React from 'react';
import { List, ListItem, ListItemAvatar, Avatar, ListItemText, ListItemButton, Typography } from '@mui/material';

export interface AlbumPhoto {
  _id: string;
  filename: string;
  signedUrl: string;
  title?: string;
  width?: number;
  height?: number;
}

interface AlbumPhotoListProps {
  photos: AlbumPhoto[];
  onPhotoClick: (photo: AlbumPhoto) => void;
}

const AlbumPhotoList: React.FC<AlbumPhotoListProps> = ({ photos, onPhotoClick }) => (
  <>
    <Typography variant="h6" gutterBottom>Photos</Typography>
    <List>
      {photos.map((photo) => (
        <ListItem key={photo._id} disablePadding>
          <ListItemButton onClick={() => onPhotoClick(photo)}>
            <ListItemAvatar>
              <Avatar src={photo.signedUrl} variant="rounded" />
            </ListItemAvatar>
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  </>
);

export default AlbumPhotoList;
