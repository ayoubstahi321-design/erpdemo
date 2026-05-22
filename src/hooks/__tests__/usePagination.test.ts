import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePagination } from '../usePagination';

describe('usePagination', () => {
  const mockData = Array.from({ length: 50 }, (_, i) => ({ id: i + 1 }));

  it('should initialize with first page', () => {
    const { result } = renderHook(() =>
      usePagination({ data: mockData, itemsPerPage: 10 })
    );

    expect(result.current.currentPage).toBe(1);
    expect(result.current.totalPages).toBe(5);
    expect(result.current.paginatedData.length).toBe(10);
  });

  it('should navigate to next page', () => {
    const { result } = renderHook(() =>
      usePagination({ data: mockData, itemsPerPage: 10 })
    );

    act(() => {
      result.current.nextPage();
    });

    expect(result.current.currentPage).toBe(2);
    expect(result.current.paginatedData[0].id).toBe(11);
  });

  it('should navigate to previous page', () => {
    const { result } = renderHook(() =>
      usePagination({ data: mockData, itemsPerPage: 10 })
    );

    act(() => {
      result.current.goToPage(3);
    });

    act(() => {
      result.current.prevPage();
    });

    expect(result.current.currentPage).toBe(2);
  });

  it('should not go beyond first page', () => {
    const { result } = renderHook(() =>
      usePagination({ data: mockData, itemsPerPage: 10 })
    );

    act(() => {
      result.current.prevPage();
    });

    expect(result.current.currentPage).toBe(1);
    expect(result.current.canGoPrev).toBe(false);
  });

  it('should not go beyond last page', () => {
    const { result } = renderHook(() =>
      usePagination({ data: mockData, itemsPerPage: 10 })
    );

    act(() => {
      result.current.goToPage(5);
    });

    act(() => {
      result.current.nextPage();
    });

    expect(result.current.currentPage).toBe(5);
    expect(result.current.canGoNext).toBe(false);
  });

  it('should calculate correct indexes', () => {
    const { result } = renderHook(() =>
      usePagination({ data: mockData, itemsPerPage: 10 })
    );

    act(() => {
      result.current.goToPage(2);
    });

    expect(result.current.startIndex).toBe(11);
    expect(result.current.endIndex).toBe(20);
  });

  it('should handle last page with fewer items', () => {
    const { result } = renderHook(() =>
      usePagination({ data: mockData, itemsPerPage: 10 })
    );

    act(() => {
      result.current.goToPage(5);
    });

    expect(result.current.paginatedData.length).toBe(10);
    expect(result.current.endIndex).toBe(50);
  });
});
