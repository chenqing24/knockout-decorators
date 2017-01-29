/**
 * Copyright (c) 2016-2017 Dmitry Panyushkin
 * Available under MIT license
 */
jest.unmock("knockout");
jest.unmock("../knockout-decorators");
jest.unmock("../observable-array");
jest.unmock("../observable-array-proxy");
jest.unmock("../observable-property");
jest.unmock("../property-extenders");

import * as ko from "knockout";
import { reactive, subscribe, unwrap, ObservableArray } from "../knockout-decorators";

describe("@reactive decorator", () => {
    it("should throw on uninitialized properties", () => {
        class ViewModel {
            @reactive field;
        }

        let vm = new ViewModel();

        expect(() => vm.field).toThrowError("@reactive property 'field' was not initialized");
    });

    it("should combine deep observable objects and arrays", () => {
        class ViewModel {
            @reactive deepObservable = {    // like @observable
                firstName: "Clive Staples", // like @observable
                lastName: "Lewis",          // like @observable

                array: [],                  // like @observableArray

                object: {                   // like @observable({ deep: true })
                    foo: "bar",             // like @observable
                    reference: null,        // like @observable({ deep: true })
                },
            }
        }

        const vm = new ViewModel();

        vm.deepObservable.array.push({
            firstName: "Clive Staples", // make @observable
            lastName: "Lewis",          // make @observable
        });

        vm.deepObservable.object.reference = {
            firstName: "Clive Staples", // make @observable
            lastName: "Lewis",          // make @observable
        };

        expect(ko.isObservable(unwrap(vm, "deepObservable"))).toBeTruthy();
        expect(ko.isObservable(unwrap(vm.deepObservable, "firstName"))).toBeTruthy();
        expect(ko.isObservable(unwrap(vm.deepObservable, "lastName"))).toBeTruthy();

        expect(ko.isObservable(unwrap(vm.deepObservable, "array"))).toBeTruthy();
        expect(ko.isObservable(unwrap(vm.deepObservable.array[0], "firstName"))).toBeTruthy();
        expect(ko.isObservable(unwrap(vm.deepObservable.array[0], "lastName"))).toBeTruthy();

        expect(ko.isObservable(unwrap(vm.deepObservable, "object"))).toBeTruthy();
        expect(ko.isObservable(unwrap(vm.deepObservable.object, "foo"))).toBeTruthy();
        expect(ko.isObservable(unwrap(vm.deepObservable.object, "reference"))).toBeTruthy();

        expect(ko.isObservable(unwrap(vm.deepObservable.object.reference, "firstName"))).toBeTruthy();
        expect(ko.isObservable(unwrap(vm.deepObservable.object.reference, "lastName"))).toBeTruthy();
    });
});

describe("@reactive decorator: initialized by object", () => {
    it("should define deep observable object property", () => {
        class ViewModel {
            @reactive object = {
                first: 123,
                second: "foo",
                reference: {
                    nested: 789,
                },
            };
        }

        let vm = new ViewModel();

        let first = unwrap<number>(vm.object, "first");
        let second = unwrap<string>(vm.object, "second");
        let reference = unwrap<Object>(vm.object, "reference");
        let nested = unwrap<number>(vm.object.reference, "nested");

        expect(ko.isObservable(first)).toBeTruthy();
        expect(ko.isObservable(second)).toBeTruthy();
        expect(ko.isObservable(reference)).toBeTruthy();
        expect(ko.isObservable(nested)).toBeTruthy();
        expect(first()).toBe(123);
        expect(second()).toBe("foo");
        expect(reference()).toEqual({ nested: 789 });
        expect(nested()).toBe(789);
    });

    it("should track deep observable object properties changes", () => {
        class ViewModel {
            @reactive object = {
                first: 123,
                second: "foo",
                reference: {
                    nested: 789,
                },
            };
        }

        let vm = new ViewModel();

        let first, second, nested;
        subscribe(() => vm.object.first, value => { first = value; });
        subscribe(() => vm.object.second, value => { second = value; });
        subscribe(() => vm.object.reference.nested, value => { nested = value; });
        
        vm.object.first = 456;
        vm.object.second = "bar";
        vm.object.reference.nested = 500;

        expect(first).toBe(456);
        expect(second).toBe("bar");
        expect(nested).toBe(500);
    });

    it("should modify plain objects", () => {
        class ViewModel {
            @reactive field = null;
        }

        let vm = new ViewModel();

        let frozenObject = Object.freeze({ foo: "bar" });

        expect(() => { vm.field = frozenObject; }).toThrow();
    });

    it("should not modify class instances", () => {
        class Model { }

        class ViewModel {
            @reactive model = null;
        }

        let vm = new ViewModel();

        let frozenObject = Object.freeze(new Model());
        vm.model = frozenObject;

        expect(vm.model).toBe(frozenObject);
    });
});

describe("@reactive decorator: initialized by array", () => {
    it("should define deep observableArray property", () => {
        class ViewModel {
            @reactive array = [];
        }

        let vm = new ViewModel();
        
        let array = Object.getOwnPropertyDescriptor(vm, "array").get;

        expect(ko.isObservable(array)).toBeTruthy();
        expect(Object.getPrototypeOf(array)).toBe(ko.observableArray.fn);
    });

    it("should track deep observableArray changes", () => {
        class ViewModel {
            @reactive array = [];
        }

        let vm = new ViewModel();

        let changesCount = 0;
        subscribe(() => vm.array, () => { changesCount++; });

        vm.array.push({ x: 1, y: 1 });
        vm.array = [{ x: 1, y: 1 }, { x: 2, y: 2 }];

        expect(changesCount).toBe(2);
    });

    it("should modify plain object array items", () => {
        class ViewModel {
            @reactive array = [];
        }

        let vm = new ViewModel();

        let frozenObject = Object.freeze({ foo: "bar" });

        expect(() => { vm.array.push(frozenObject); }).toThrow();
    });

    it("should not modify class instance array items", () => {
        class Model { }

        class ViewModel {
            @reactive array = [];
        }

        let vm = new ViewModel();

        let frozenObject = Object.freeze(new Model());
        vm.array.push(frozenObject);

        expect(vm.array[0]).toBe(frozenObject);
    });

    it("should expose knockout-specific methods", () => {
        class ViewModel {
            @reactive array = [1, 2, 3, 4, 3, 2, 1] as ObservableArray<number>;
        }
        
        let vm = new ViewModel();
        let changes = [];

        vm.array.subscribe(val => { changes.push(...val); }, null, "arrayChange");
        
        vm.array.remove(val => val % 2 === 0);
        vm.array.splice(2, 0, 5);
        vm.array.replace(5, 7);

        expect(vm.array).toEqual([1, 3, 7, 3, 1]);
        expect(changes).toEqual([
            { status: 'deleted', value: 2, index: 1 },
            { status: 'deleted', value: 4, index: 3 },
            { status: 'deleted', value: 2, index: 5 },
            { status: 'added', value: 5, index: 2 },
            { status: 'added', value: 7, index: 2 },
            { status: 'deleted', value: 5, index: 2 },
        ]);
    });

    it("should clear array methods on previous observableArray value", () => {
        class ViewModel {
            @reactive array = [1, 2, 3];
        }
        
        let vm = new ViewModel();
        let previous = vm.array;
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
            @reactive arrayFirst = [1, 2] as ObservableArray<number>;
            @reactive arraySecond = [3, 4] as ObservableArray<number>;
        }

        let vm = new ViewModel();
        let changesFirst = [];
        let changesSecond = [];

        vm.arrayFirst.subscribe(val => { changesFirst.push(...val); }, null, "arrayChange");
        vm.arraySecond.subscribe(val => { changesSecond.push(...val); }, null, "arrayChange");

        // assign pointer to array
        vm.arrayFirst = vm.arraySecond;
        vm.arrayFirst.push(5, 6);

        expect(vm.arrayFirst).not.toBe(vm.arraySecond);

        expect(vm.arrayFirst).toEqual([3, 4, 5, 6]);
        expect(vm.arraySecond).toEqual([3, 4]);

        expect(changesFirst).toEqual([
            { status: 'added', value: 3, index: 0 },
            { status: 'deleted', value: 1, index: 0 },
            { status: 'added', value: 4, index: 1 },
            { status: 'deleted', value: 2, index: 1 },
            { status: 'added', value: 5, index: 2 },
            { status: 'added', value: 6, index: 3 },
        ]);
        expect(changesSecond).toEqual([]);
    });

    it("should have 'mutate' method", () => {
        class ViewModel {
            @reactive array = [1, 2, 3] as ObservableArray<any>;
        }

        let vm = new ViewModel();
        let changes = [];

        vm.array.subscribe(val => { changes.push(...val); }, null, "arrayChange");

        vm.array.mutate((array) => {
            array[1] = 4;
        });

        expect(vm.array).toEqual([1, 4, 3]);
        expect(changes).toEqual([
            { status: 'added', value: 4, index: 1 },
            { status: 'deleted', value: 2, index: 1 },
        ]);
    });

    it("should have 'set' method", () => {
        class ViewModel {
            @reactive array = [1, 2, 3] as ObservableArray<any>;
        }

        let vm = new ViewModel();
        let changes = [];

        vm.array.subscribe(val => { changes.push(...val); }, null, "arrayChange");

        let oldValue = vm.array.set(1, 4);

        expect(oldValue).toBe(2);
        expect(vm.array).toEqual([1, 4, 3]);
        expect(changes).toEqual([
            { status: 'deleted', value: 2, index: 1 },
            { status: 'added', value: 4, index: 1 },
        ]);
    });
});