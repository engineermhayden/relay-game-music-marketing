// Review-only probes: assertions describe observed defects, not desired behavior.
import React from 'react';
import { renderHook, act, render, fireEvent, cleanup } from '@testing-library/react';
import { useGalileoStateSpring } from './src/hooks/useGalileoStateSpring';
import { useGalileoSprings } from './src/hooks/useGalileoSprings';
import { MultiSpring } from './src/animations/physics/multiSpring';
import { StandardDateRangePresets } from './src/components/DateRangePicker/DateRangePresets';
import { MenuItem } from './src/components/MenuItem/MenuItem';
import { GlassDataGrid } from './src/components/GlassDataGrid/GlassDataGrid';
jest.mock('./src/animations/physics', () => ({useVectorSpring: () => ({value:{x:0,y:0,z:0},start:jest.fn()})}));
jest.mock('./src/components/surfaces/DimensionalGlass', () => ({__esModule:true,default:({children}:any) => <div>{children}</div>}));
jest.mock('./src/hooks/useDraggableListPhysics', () => ({useDraggableListPhysics:jest.fn(() => ({styles:[],getHandlers:()=>({}),isDragging:false,draggedIndex:null}))}));
import { useDraggableListPhysics } from './src/hooks/useDraggableListPhysics';
import { ThemeProvider, useColorMode } from './src/theme/ThemeProvider';
import { useGlassTheme } from './src/hooks/useGlassTheme';
import { Select } from './src/components/Select/Select';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { GlassCarousel } from './src/components/Carousel/GlassCarousel';
import { GlassFocusRing } from './src/components/GlassFocusRing/GlassFocusRing';
jest.mock('./src/components/Carousel/components', () => {
  const React = require('react');
  return {
    CarouselContainer: React.forwardRef(({children}:any, ref:any) => <div ref={ref}>{children}</div>),
    CarouselNavigation: ({onNextClick}:any) => <button onClick={onNextClick}>next</button>,
    CarouselIndicators: () => null,
    PlayPauseControl: () => null,
  };
});
jest.mock('./src/hooks/useReducedMotion', () => ({useReducedMotion: () => false}));
jest.mock('./src/contexts/AnimationContext', () => ({useAnimationContext: () => ({defaultSpring: 'DEFAULT'})}));
let callbacks: Map<number, FrameRequestCallback>;
let serial: number;
beforeEach(() => {
  callbacks = new Map(); serial = 0;
  global.requestAnimationFrame = jest.fn(cb => { callbacks.set(++serial, cb); return serial; });
  global.cancelAnimationFrame = jest.fn(id => { callbacks.delete(id); });
  window.matchMedia = jest.fn(() => ({matches:false,addEventListener:jest.fn(),removeEventListener:jest.fn(),addListener:jest.fn(),removeListener:jest.fn()})) as any;
});
afterEach(cleanup);
test('Last Month produces March rather than February on March 31', () => {
  const range: any = StandardDateRangePresets.find(p => p.id === 'lastMonth')!.getRangeFunction(new Date(2026,2,31));
  expect(range.startDate.getMonth()).toBe(2);
  expect(range.endDate.getMonth()).toBe(2);
});
test('MultiSpring nonzero initial position jumps back near zero on first step', () => {
  const spring = new MultiSpring({x: 100});
  spring.setTarget({to: {x: 200}});
  expect(spring.update().x).toBeLessThan(100);
});
test('MenuItem loses its children and click handler', () => {
  const handler = jest.fn();
  const view = render(<MenuItem onClick={handler}>Delete record</MenuItem>);
  fireEvent.click(view.container.querySelector('li')!);
  expect(view.container.textContent).toBe('MenuItem Placeholder');
  expect(handler).not.toHaveBeenCalled();
});
test('State spring jumps to new reactive target before any animation frame', () => {
  const hook = renderHook(({target}) => useGalileoStateSpring(target), {initialProps:{target:0}});
  hook.rerender({target:100});
  expect(hook.result.current.value).toBe(100);
  expect(callbacks.size).toBeGreaterThan(0);
});
test('State spring retains a scheduled frame after unmount', () => {
  const hook = renderHook(() => useGalileoStateSpring(0));
  act(() => hook.result.current.start({to:100}));
  expect(callbacks.size).toBeGreaterThan(0);
  hook.unmount();
  expect(callbacks.size).toBeGreaterThan(0);
});
test('Immediate multi-spring with an inline target repeatedly rerenders', () => {
  let renders = 0;
  const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    expect(() => renderHook(() => {
      if (++renders > 30) throw new Error('review render limit');
      return useGalileoSprings({x:1}, {immediate:true});
    })).toThrow('review render limit');
    expect(renders).toBeGreaterThan(30);
  } finally { errors.mockRestore(); }
});
test('Immediate multi-spring never reports onRest after target changes', () => {
  const onRest = jest.fn();
  const first = {x:0}, second = {x:1};
  const hook = renderHook(({target}) => useGalileoSprings(target, {immediate:true,onRest}), {initialProps:{target:first}});
  hook.rerender({target:second});
  expect(hook.result.current.x).toBe(1);
  expect(onRest).not.toHaveBeenCalled();
});
test('Grid mounted empty stays empty after loading rows', () => {
  const columns = [{id:'name',accessorKey:'name',header:'Name',sortable:true}];
  const view = render(<GlassDataGrid columns={columns} data={[]} />);
  view.rerender(<GlassDataGrid columns={columns} data={[{id:1,name:'Alice'}]} />);
  expect(view.container.querySelectorAll('tbody tr')).toHaveLength(0);
});
test('Grid crashes when a populated data array shrinks', () => {
  const columns = [{id:'name',accessorKey:'name',header:'Name',sortable:true}];
  const view = render(<GlassDataGrid columns={columns} data={[{id:1,name:'Alice'}]} />);
  const errors = jest.spyOn(console,'error').mockImplementation(()=>{});
  try { expect(() => view.rerender(<GlassDataGrid columns={columns} data={[]} />)).toThrow(); }
  finally { errors.mockRestore(); }
});
test('Grid sorts on column id instead of accessorKey', () => {
  const columns = [{id:'nameColumn',accessorKey:'name',header:'Name',sortable:true}];
  const view = render(<GlassDataGrid columns={columns} data={[{id:1,name:'Zoe'},{id:2,name:'Alice'}]} />);
  fireEvent.click(view.getByRole('columnheader'));
  expect(view.container.querySelector('tbody tr')!.textContent).toBe('Zoe');
});
test('Grid reorder callback returns a different order than sorted visible rows', () => {
  const columns = [{id:'name',accessorKey:'name',header:'Name',sortable:true}];
  const data = [{id:1,name:'Zoe'},{id:2,name:'Alice'}];
  const onChange = jest.fn();
  const view = render(<GlassDataGrid columns={columns} data={data} initialSort={{columnId:'name',direction:'asc'}} onRowOrderChange={onChange} />);
  const calls = (useDraggableListPhysics as jest.Mock).mock.calls;
  act(() => calls[calls.length-1][0].onOrderChange([1,0]));
  expect(view.container.querySelector('tbody tr')!.textContent).toBe('Zoe');
  expect(onChange.mock.calls[0][0][0].name).toBe('Alice');
});
test('Glass theme hook stays light inside the real dark ThemeProvider', () => {
  const wrapper = ({children}:any) => <ThemeProvider forceColorMode="dark" enableAutoDetection={false}>{children}</ThemeProvider>;
  const hook = renderHook(() => ({glass:useGlassTheme(),color:useColorMode()}), {wrapper});
  expect(hook.result.current.color.isDarkMode).toBe(true);
  expect(hook.result.current.glass.isDarkMode).toBe(false);
});
test('ThemeProvider mounting throws if storage reads are denied', () => {
  const storage = jest.spyOn(Storage.prototype,'getItem').mockImplementation(() => {throw new Error('storage denied');});
  const errors = jest.spyOn(console,'error').mockImplementation(()=>{});
  try { expect(() => render(<ThemeProvider enableAutoDetection={false}><span>hello</span></ThemeProvider>)).toThrow('storage denied'); }
  finally {storage.mockRestore(); errors.mockRestore();}
});
test('Select cannot commit an option using keyboard navigation', () => {
  const onChange = jest.fn();
  const view = render(<StyledThemeProvider theme={{}}><Select options={[{value:'a',label:'Alpha'},{value:'b',label:'Beta'}]} onChange={onChange} label="Choice" /></StyledThemeProvider>);
  const control = view.getByRole('combobox');
  fireEvent.keyDown(control,{key:'Enter'});
  fireEvent.keyDown(control,{key:'ArrowDown'});
  fireEvent.keyDown(control,{key:'Enter'});
  expect(onChange).not.toHaveBeenCalled();
  expect(document.getElementById(control.getAttribute('aria-labelledby')!)).toBeNull();
});
test('Carousel advances controls but its track remains at zero because containerRef is unattached', () => {
  const width = jest.spyOn(HTMLElement.prototype,'offsetWidth','get').mockReturnValue(300);
  try {
    const view = render(<GlassCarousel itemWidth={200}><div>one</div><div>two</div><div>three</div></GlassCarousel>);
    const track = view.container.querySelector('[style*="translateX"]') as HTMLElement;
    fireEvent.click(view.getByText('next'));
    expect(track.style.transform).toBe('translateX(0px)');
  } finally { width.mockRestore(); }
});
test('Focus ring stays hidden when its actual button receives focus', () => {
  const view=render(<GlassFocusRing><button>focus target</button></GlassFocusRing>);
  act(()=>view.getByRole('button').focus());
  expect(document.activeElement).toBe(view.getByRole('button'));
  expect(view.getByTestId('glass-focus-ring-element').style.opacity).toBe('0');
});
