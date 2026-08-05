import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Divider, Link, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { logger } from '@tumbaland/frontend-core';
import { Place, PlaceVisit } from '../../services/types';
import { getPlaceVisits } from '../../services/places';

interface PlacePopupProps {
  place: Place;
  groupId?: string;
}

const VISIT_LIMIT = 12;

const formatDate = (date: string): string =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

/**
 * A pin's detail card: what this place is, how often it's been visited, and
 * the individual visits — each linking to that day in the journal.
 *
 * Visits load when the popup opens rather than with the map, so a scope with
 * hundreds of pins doesn't fetch every visit list up front.
 */
const PlacePopup: React.FC<PlacePopupProps> = ({ place, groupId }) => {
  const [visits, setVisits] = useState<PlaceVisit[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPlaceVisits(place.lat, place.lng, { groupId, limit: VISIT_LIMIT })
      .then((result) => {
        if (!cancelled) setVisits(result);
      })
      .catch((e) => {
        logger.error('Failed to load visits for a place', e);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [place.lat, place.lng, groupId]);

  return (
    <Box sx={{ minWidth: 210, maxWidth: 280 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.25 }}>
        {place.label}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
        {place.visits} visit{place.visits === 1 ? '' : 's'} · first {formatDate(place.firstVisit)}
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
        {place.types.map((type) => (
          <Box
            key={type.typeId}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 0.75,
              py: 0.25,
              borderRadius: 1,
              border: '1px solid',
              borderColor: type.color || 'divider'
            }}
          >
            <Box
              sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: type.color || '#9e9e9e' }}
            />
            <Typography variant="caption">
              {type.name} · {type.count}
            </Typography>
          </Box>
        ))}
      </Box>

      <Divider sx={{ my: 1 }} />

      {failed ? (
        <Typography variant="caption" sx={{ color: 'error.main' }}>
          Could not load the visits
        </Typography>
      ) : visits === null ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
          <CircularProgress size={18} />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 180, overflowY: 'auto' }}>
          {visits.map((visit, index) => (
            <Box key={`${visit.date}-${visit.typeId}-${index}`} sx={{ display: 'flex', gap: 0.75 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  mt: 0.6,
                  borderRadius: '50%',
                  flexShrink: 0,
                  bgcolor: visit.typeColor || '#9e9e9e'
                }}
              />
              <Box sx={{ minWidth: 0 }}>
                <Link
                  component={RouterLink}
                  to={`/journal?date=${visit.date}`}
                  variant="caption"
                  sx={{ fontWeight: 600 }}
                >
                  {formatDate(visit.date)}
                </Link>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  {[visit.typeName, visit.description, visit.hours !== undefined ? `${visit.hours}h` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </Typography>
              </Box>
            </Box>
          ))}
          {place.visits > visits.length && (
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5 }}>
              Showing the {visits.length} most recent
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
};

export default PlacePopup;
