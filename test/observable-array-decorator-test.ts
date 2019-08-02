/**
 * Copyright (c) 2016-2017 Dmitry Panyushkin
 * Available under MIT license
 */
Symbol = undefined as any;
import * as ko from "knockout";
import { observableArray, ObservableArray } from "../src/knockout-decorators";

describe("@observableArray decorator", () => {
  it("should throw on uninitialized properties", () => {
    class ViewModel {
      @observableArray array: any[];
    }

    const vm = new ViewModel();

    expect(() => vm.array).toThrowError("@observable property 'array' was not initialized");
  });

  it("should define hidden observableArray", () => {
    class ViewModel {
      @observableArray array: any[] = [];
    }

    const vm = new ViewModel();

    const array = Object.getOwnPropertyDescriptor(vm, "array")!.get;

    expect(ko.isObservable(array)).toBeTruthy();
    expect(Object.getPrototypeOf(array)).toBe(ko.observableArray.fn);
  });

  it("should track hidden observable changes", () => {
    class ViewModel {
      @observableArray array: number[] = [];
    }

    const vm = new ViewModel();
    let syncArr: any[] = [];
    ko.computed(() => { syncArr = vm.array; });

    const arr = [1, 2, 3];
    vm.array = arr;

    expect(syncArr).toBe(arr);
  });

  it("should track hidden observableArray changes", () => {
    class ViewModel {
      @observableArray array: number[] = [];
    }

    const vm = new ViewModel();

    let syncArr: any[] = [];
    ko.computed(() => { syncArr = vm.array; });

    const arr = [1, 2, 3];
    vm.array = arr;

    const removed = vm.array.splice(1, 1);

    expect(syncArr).toBe(arr);
    expect(removed).toEqual([2]);
    expect(arr).toEqual([1, 3]);
  });

  it("should expose knockout-specific methods", () => {
    class ViewModel {
      @observableArray array = [1, 2, 3, 4, 3, 2, 1] as ObservableArray<number>;
    }

    const vm = new ViewModel();
    const changes: ko.utils.ArrayChange<number>[] = [];

    vm.array.subscribe((val) => { changes.push(...val); }, null, "arrayChange");

    vm.array.remove((val) => val % 2 === 0);
    vm.array.splice(2, 0, 5);
    vm.array.replace(5, 7);

    expect(vm.array).toEqual([1, 3, 7, 3, 1]);
    expect(changes).toEqual([
      { status: "deleted", value: 2, index: 1 },
      { status: "deleted", value: 4, index: 3 },
      { status: "deleted", value: 2, index: 5 },
      { status: "added", value: 5, index: 2 },
      { status: "added", value: 7, index: 2 },
      { status: "deleted", value: 5, index: 2 },
    ]);
  });

  it("should clear array methods on previous observableArray value", () => {
    class ViewModel {
      @observableArray array = [1, 2, 3];
    }

    const vm = new ViewModel();
    const previous = vm.array;
    vm.array = [4, 5, 6];

    expect(previous).not.toBe(vm.array);
    expect(Object.hasOwnProperty.call(previous, "push")).toBeFalsy();
    expect(Object.hasOwnProperty.call(previous, "subscribe")).toBeFalsy();
    expect(Object.hasOwnProperty.call(previous, "mutate")).toBeFalsy();
    expect(Object.hasOwnProperty.call(previous, "set")).toBeFalsy();
    expect(Object.hasOwnProperty.call(vm.array, "push")).toBeTruthy();
    expect(Object.hasOwnProperty.call(vm.array, "subscribe")).toBeTruthy();
    expect(Object.hasOwnProperty.call(vm.array, "mutate")).toBeTruthy();
    expect(Object.hasOwnProperty.call(vm.array, "set")).toBeTruthy();
  });

  it("should clone array if it is @observableArray from another field", () => {
    class ViewModel {
      @observableArray arrayFirst = [1, 2] as ObservableArray<number>;
      @observableArray arraySecond = [3, 4] as ObservableArray<number>;
    }

    const vm = new ViewModel();
    const changesFirst: ko.utils.ArrayChange<number>[] = [];
    const changesSecond: ko.utils.ArrayChange<number>[] = [];

    vm.arrayFirst.subscribe((val) => { changesFirst.push(...val); }, null, "arrayChange");
    vm.arraySecond.subscribe((val) => { changesSecond.push(...val); }, null, "arrayChange");

    // assign pointer to array
    vm.arrayFirst = vm.arraySecond;
    vm.arrayFirst.push(5, 6);

    expect(vm.arrayFirst).not.toBe(vm.arraySecond);

    expect(vm.arrayFirst).toEqual([3, 4, 5, 6]);
    expect(vm.arraySecond).toEqual([3, 4]);

    expect(changesFirst).toEqual([
      { status: "added", value: 3, index: 0 },
      { status: "deleted", value: 1, index: 0 },
      { status: "added", value: 4, index: 1 },
      { status: "deleted", value: 2, index: 1 },
      { status: "added", value: 5, index: 2 },
      { status: "added", value: 6, index: 3 },
    ]);
    expect(changesSecond).toEqual([]);
  });

  it("should have 'mutate' method", () => {
    class ViewModel {
      @observableArray array = [1, 2, 3] as ObservableArray<any>;
    }

    const vm = new ViewModel();
    const changes: ko.utils.ArrayChange<number>[] = [];

    vm.array.subscribe((val) => { changes.push(...val); }, null, "arrayChange");

    vm.array.mutate((array) => {
      array[1] = 4;
    });

    expect(vm.array).toEqual([1, 4, 3]);
    expect(changes).toEqual([
      { status: "added", value: 4, index: 1 },
      { status: "deleted", value: 2, index: 1 },
    ]);
  });

  it("should have 'set' method", () => {
    class ViewModel {
      @observableArray array = [1, 2, 3] as ObservableArray<any>;
    }

    const vm = new ViewModel();
    const changes: ko.utils.ArrayChange<number>[] = [];

    vm.array.subscribe((val) => { changes.push(...val); }, null, "arrayChange");

    const oldValue = vm.array.set(1, 4);

    expect(oldValue).toBe(2);
    expect(vm.array).toEqual([1, 4, 3]);
    expect(changes).toEqual([
      { status: "deleted", value: 2, index: 1 },
      { status: "added", value: 4, index: 1 },
    ]);
  });

  it("sould write null values to property", () => {
    class ViewModel {
      @observableArray array = [] as any as ObservableArray<any> | null;
    }

    const vm = new ViewModel();

    // check property is valid
    expect(Array.isArray(vm.array)).toBeTruthy();
    expect(ko.isObservable(Object.getOwnPropertyDescriptor(vm, "array")!.get)).toBeTruthy();

    // set null
    vm.array = null;

    expect(vm.array).toBe(null);
    expect(ko.isObservable(Object.getOwnPropertyDescriptor(vm, "array")!.get)).toBeTruthy();

    // set same value
    vm.array = vm.array;

    expect(vm.array).toBe(null);
    expect(ko.isObservable(Object.getOwnPropertyDescriptor(vm, "array")!.get)).toBeTruthy();

    // set an array
    vm.array = [] as any;

    expect(Array.isArray(vm.array)).toBeTruthy();
    expect(ko.isObservable(Object.getOwnPropertyDescriptor(vm, "array")!.get)).toBeTruthy();
  });
});
