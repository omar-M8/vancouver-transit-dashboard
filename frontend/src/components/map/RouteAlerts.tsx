import { useState } from 'react';
import { Anchor, Collapse, Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconAlertTriangle, IconChevronDown } from '@tabler/icons-react';
import { useMapStore } from '../../stores/useMapStore';

/** How many alerts to list before "and N more" */
const MAX_LISTED = 3;

/** "DETOUR" -> "Detour", "REDUCED_SERVICE" -> "Reduced service" 
 * @param effect The GTFS-RT alert effect string
 * @returns A human-readable label for the effect, or null if it is not a meaningful effect
*/
function effectLabel(effect: string): string | null {
  if (effect === 'UNKNOWN_EFFECT' || effect === 'OTHER_EFFECT' || effect === 'NO_EFFECT') return null;
  const words = effect.toLowerCase().replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Service alerts affecting one route, collapsed to a single amber line until opened. Nothing when there are none.
 * @param routeId The route ID to show alerts for
 * @returns A component showing the number of alerts and a collapsible list of them 
 */
export function RouteAlerts({ routeId }: { routeId: string }) {
  const alerts = useMapStore((s) => s.alerts);
  const [open, setOpen] = useState(false);
  const routeAlerts = alerts.filter((alert) => alert.routeIds.includes(routeId));

  if (routeAlerts.length === 0) return null;

  const listId = `route-alerts-${routeId}`;
  const count = routeAlerts.length;

  return (
    <div>
      <UnstyledButton onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls={listId} w="100%">
        <Group gap={6} wrap="nowrap">
          <IconAlertTriangle size={14} color="#fbbf24" aria-hidden style={{ flexShrink: 0 }} />
          <Text size="xs" fw={600} c="#fbbf24" style={{ flex: 1 }}>
            {count} service alert{count === 1 ? '' : 's'} on this route
          </Text>
          <IconChevronDown
            size={14}
            color="#fbbf24"
            aria-hidden
            style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 150ms' }}
          />
        </Group>
      </UnstyledButton>
      <Collapse expanded={open} id={listId}>
        <Stack gap={8} mt={8} component="ul" style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
          {routeAlerts.slice(0, MAX_LISTED).map((alert) => {
            const effect = effectLabel(alert.effect);
            return (
              <li key={alert.id}>
                <Text size="xs" c="#e2e8f0">
                  {effect && (
                    <Text span fw={700} inherit>
                      {effect}:{' '}
                    </Text>
                  )}
                  {alert.header}
                  {alert.url && (
                    <>
                      {' '}
                      <Anchor href={alert.url} target="_blank" rel="noreferrer" size="xs" c="cyan">
                        Details
                      </Anchor>
                    </>
                  )}
                </Text>
              </li>
            );
          })}
          {count > MAX_LISTED && (
            <li>
              <Text size="xs" c="dimmed">
                and {count - MAX_LISTED} more
              </Text>
            </li>
          )}
        </Stack>
      </Collapse>
    </div>
  );
}
