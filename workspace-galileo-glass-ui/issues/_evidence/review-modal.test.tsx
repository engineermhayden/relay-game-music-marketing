import React from 'react';
import {render,cleanup} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {Modal} from './src/components/Modal/Modal';
jest.mock('./src/hooks/useReducedMotion',()=>({useReducedMotion:()=>false}));
jest.mock('./src/contexts/AnimationContext',()=>({useAnimationContext:()=>({defaultSpring:'DEFAULT'})}));
// Isolate focus/scroll handling from independently defective multi-spring lifecycle.
jest.mock('./src/hooks/useGalileoSprings',()=>({useGalileoSprings:(targets:any)=>targets}));
beforeEach(()=>{
  global.requestAnimationFrame=jest.fn(()=>1);
  window.matchMedia=jest.fn(()=>({matches:false,addEventListener:jest.fn(),removeEventListener:jest.fn()})) as any;
});
afterEach(()=>{cleanup();document.body.style.overflow='';});
test('Tab leaves an open modal and focuses background content',async()=>{
  const view=render(<><Modal open><button>inside</button></Modal><button>outside</button></>);
  view.getByText('inside').focus();
  await userEvent.tab();
  // Portal is appended after background nodes; first tab reaches body, then background.
  if(document.activeElement===document.body) await userEvent.tab();
  expect(document.activeElement).toBe(view.getByText('outside'));
});
test('Unmounting one modal unlocks body scrolling while another remains open',()=>{
  const first=render(<Modal open><button>first</button></Modal>);
  const second=render(<Modal open><button>second</button></Modal>);
  expect(document.body.style.overflow).toBe('hidden');
  first.unmount();
  expect(second.getByText('second')).toBeTruthy();
  expect(document.body.style.overflow).toBe('');
});
