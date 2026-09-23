import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CollagePeopleFaces, CollagePerson, personColour, RemoteSelections } from './CollagePeople';
import { CollageDoc } from './collageDoc';

const irja: CollagePerson = { userId: 'u-irja', name: 'Irja Tamm', picture: null, color: '#ec4899', selection: 'a' };

const doc: CollageDoc = {
  canvas: { width: 1600, height: 900 },
  background: '#fff',
  frameEnabled: false,
  frameColor: '#fff',
  photos: [{ id: 'a', photoId: 'p1', x: 10, y: 20, width: 100, height: 80, rotation: 0, caption: '' }],
  texts: []
};

describe('CollagePeopleFaces', () => {
  it('says who else is here', () => {
    render(<CollagePeopleFaces people={[irja]} />);
    expect(screen.getByLabelText('Irja Tamm is here')).toBeInTheDocument();
    expect(screen.getByText('IT')).toBeInTheDocument();
  });

  it('names everyone when there are several', () => {
    render(<CollagePeopleFaces people={[irja, { ...irja, userId: 'u-3', name: 'Mari' }]} />);
    expect(screen.getByLabelText('Irja Tamm and Mari are here')).toBeInTheDocument();
  });

  it('shows nothing when you are on your own', () => {
    const { container } = render(<CollagePeopleFaces people={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('RemoteSelections', () => {
  it('outlines what someone has selected, with their name', () => {
    render(<RemoteSelections doc={doc} people={[irja]} scale={1} />);
    const outline = screen.getByTestId('remote-selection-u-irja');
    expect(outline).toHaveStyle({ left: '10px', top: '20px', width: '100px', height: '80px' });
    expect(outline).toHaveTextContent('Irja Tamm');
  });

  it('draws nothing for someone with nothing selected, or with an item since removed', () => {
    render(
      <RemoteSelections
        doc={doc}
        people={[
          { ...irja, selection: null },
          { ...irja, userId: 'u-3', selection: 'gone' }
        ]}
        scale={1}
      />
    );
    expect(screen.queryByTestId(/remote-selection/)).not.toBeInTheDocument();
  });
});

describe('RemoteSelections while someone is moving an item', () => {
  it('outlines the item where they have it, and says they are moving it', () => {
    const moved = { ...doc, photos: [{ ...doc.photos[0]!, x: 300 }] };
    render(
      <RemoteSelections
        doc={moved}
        people={[{ ...irja, selection: null }]}
        motions={[{ userId: 'u-irja', item: { id: 'a', x: 300, y: 20, width: 100, height: 80 } }]}
        scale={1}
      />
    );
    const outline = screen.getByTestId('remote-selection-u-irja');
    expect(outline).toHaveStyle({ left: '300px' });
    expect(outline).toHaveTextContent('Irja Tamm is moving this');
  });
});

describe('personColour', () => {
  it('gives the same person the same colour every time', () => {
    expect(personColour('u-irja')).toBe(personColour('u-irja'));
    expect(personColour('u-irja')).toMatch(/^#[0-9a-f]{6}$/);
  });
});
