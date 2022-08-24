import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FieldValidator } from 'final-form';

import { Field } from '../src/Field';
import { Form } from 'react-final-form';

const isEven: FieldValidator<string> = (value) =>
  parseInt(value) % 2 === 0 ? undefined : 'Not even';

const isSmallerThan10: FieldValidator<string> = (value) =>
  parseInt(value) < 10 ? undefined : 'Bigger than 10';

const isNumber8: FieldValidator<string> = async (value) => {
  return new Promise((resolve) => {
    setTimeout(
      () => resolve(parseInt(value) === 8 ? undefined : 'Value is not 8'),
      100
    );
  });
};

describe('Component: Field', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runAllTimers();
    jest.useRealTimers();
  });

  describe('validators', () => {
    function setup({ validators }: { validators?: FieldValidator<string>[] }) {
      const renderSpy = jest
        .fn()
        .mockImplementation(({ input, meta: { error } }) => (
          <div>
            <input {...input} />
            <div data-testid="errors">{error && error.join(', ')}</div>
          </div>
        ));

      render(
        <Form onSubmit={jest.fn()}>
          {() => (
            <Field name="Name" validators={validators} render={renderSpy} />
          )}
        </Form>
      );

      return { renderSpy };
    }

    it('should run validators when they are provided by the user', async () => {
      expect.assertions(0);

      // Should work with FieldValidators which return a Promise
      const isBatman: FieldValidator<string> = (value) =>
        value !== 'Batman'
          ? Promise.resolve('Not Batman')
          : Promise.resolve(undefined);

      // Should work with FieldValidators which do not return a promise
      const isRobin: FieldValidator<string> = (value) =>
        value !== 'Robin' ? 'Not Robin' : undefined;

      setup({ validators: [isBatman, isRobin] });

      await screen.findByText('Not Batman, Not Robin');
    });

    it('should render without validators', async () => {
      expect.assertions(4);

      const { renderSpy } = setup({});

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 42 } });

      await waitFor(() => {
        expect(renderSpy).toHaveBeenCalledTimes(4);
      });

      expect(renderSpy.mock.calls.pop()[0]).toMatchObject({
        meta: {
          valid: true,
          invalid: false,
          error: undefined
        }
      });
    });

    it('should render when validators is empty array', async () => {
      expect.assertions(4);

      const { renderSpy } = setup({ validators: [] });

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 42 } });

      await waitFor(() => {
        expect(renderSpy).toHaveBeenCalledTimes(4);
      });

      expect(renderSpy.mock.calls.pop()[0]).toMatchObject({
        meta: {
          valid: true,
          invalid: false,
          error: undefined
        }
      });
    });

    it('should filter out results which return undefined so only errors remain', async () => {
      expect.assertions(4);

      const { renderSpy } = setup({ validators: [isEven, isSmallerThan10] });

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 12 } });

      await waitFor(() => {
        expect(renderSpy).toHaveBeenCalledTimes(4);
      });

      expect(renderSpy.mock.calls.pop()[0]).toMatchObject({
        meta: {
          valid: false,
          invalid: true,
          error: ['Bigger than 10']
        }
      });
    });
  });

  describe('asyncValidators', () => {
    function setup({
      validators,
      asyncValidatorsDebounce
    }: {
      validators?: FieldValidator<string>[];
      asyncValidatorsDebounce?: number;
    }) {
      const isNumber8Spy = jest.fn(isNumber8);
      const renderSpy = jest
        .fn()
        .mockImplementation(({ input, meta: { error } }) => (
          <div>
            <input {...input} />
            <div data-testid="errors">{error && error.join(', ')}</div>
          </div>
        ));

      render(
        <Form onSubmit={jest.fn()}>
          {() => (
            <Field
              name="Name"
              validators={validators}
              asyncValidators={[isNumber8Spy]}
              asyncValidatorsDebounce={asyncValidatorsDebounce}
            >
              {renderSpy}
            </Field>
          )}
        </Form>
      );

      return { renderSpy, isNumber8Spy };
    }

    it('should when there are no errors perform async validations', async () => {
      expect.assertions(0);

      setup({ validators: [isEven] });

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 2 } });

      jest.runAllTimers();

      await screen.findByText('Value is not 8');
    });

    it('should return undefined when both async and sync validation have no errors', async () => {
      expect.assertions(10);

      const { renderSpy } = setup({ validators: [isEven] });

      jest.runAllTimers();

      await screen.findByText('Not even');

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 8 } });

      jest.runAllTimers();

      await waitFor(() => {
        expect(renderSpy).toHaveBeenCalledTimes(6);
      });

      expect(screen.getByTestId('errors').innerText).toBeUndefined();
    });

    it('should debounce with 200 milliseconds by default', async () => {
      expect.assertions(2);

      const timeoutSpy = jest.spyOn(global, 'setTimeout');

      setup({});

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 42 } });

      jest.runAllTimers();

      await screen.findByText('Value is not 8');

      expect(timeoutSpy).toHaveBeenCalled();
      expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 200);
    });

    it('should accept a custom debounce', async () => {
      expect.assertions(2);

      const timeoutSpy = jest.spyOn(global, 'setTimeout');

      setup({ asyncValidatorsDebounce: 300 });

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 42 } });

      jest.runAllTimers();

      await screen.findByText('Value is not 8');

      expect(timeoutSpy).toHaveBeenCalled();
      expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 300);
    });

    it('should when two async validations happen after each other cancel the first one', async () => {
      expect.assertions(1);

      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      setup({ validators: [isEven] });

      jest.runAllTimers();

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 4 } });

      jest.advanceTimersByTime(100);

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 42 } });

      jest.runAllTimers();

      await screen.findByText('Value is not 8');

      expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    });
  });
});
