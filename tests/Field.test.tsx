import {
  act,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react';
import { FieldValidator } from 'final-form';

import { Field } from '../src/Field';
import { Form } from 'react-final-form';

const isEven: FieldValidator<string> = (value) =>
  parseInt(value) % 2 === 0 ? undefined : 'Not even';

const isSmallerThan10: FieldValidator<string> = (value) =>
  parseInt(value) < 10 ? undefined : 'Bigger than 10';

function resolvablePromise<R>() {
  let resolve: (result?: Promise<R> | R) => void = () => undefined;

  const promise = new Promise((r) => {
    resolve = r;
  });

  return { promise, resolve };
}

const makeIsNumber8Validator = () => {
  const { promise, resolve } = resolvablePromise<string | undefined>();

  const validator: FieldValidator<string> = jest
    .fn()
    .mockImplementation((value) => {
      resolve(parseInt(value) === 8 ? undefined : 'Value is not 8');
      return promise;
    });

  return { promise, validator };
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
      expect.assertions(3);

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
      expect.assertions(3);

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
      expect.assertions(3);

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
      const { promise, validator } = makeIsNumber8Validator();
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
              asyncValidators={[validator]}
              asyncValidatorsDebounce={asyncValidatorsDebounce}
            >
              {renderSpy}
            </Field>
          )}
        </Form>
      );

      return { renderSpy, promise, validator };
    }

    it('should perform async validations when there are no errors', async () => {
      expect.assertions(2);

      const { validator } = setup({ validators: [isEven] });

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 2 } });

      jest.runAllTimers();

      await screen.findByText('Value is not 8');

      expect(validator).toHaveBeenCalledTimes(1);
      expect(validator).toHaveBeenCalledWith(
        '2',
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should return undefined when both async and sync validation have no errors', async () => {
      expect.assertions(10);

      const { renderSpy, promise, validator } = setup({
        validators: [isEven]
      });
      await waitFor(() => expect(jest.getTimerCount()).toBe(2));

      await screen.findByText('Not even');

      await act(() => {
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 8 } });
      });

      await waitFor(() => expect(jest.getTimerCount()).toBe(3));
      jest.advanceTimersByTime(201);

      await waitFor(() => expect(validator).toHaveBeenCalledTimes(1));
      expect(validator).toHaveBeenCalledWith(
        '8',
        expect.any(Object),
        expect.any(Object)
      );

      await expect(promise).resolves.toBeUndefined();

      await waitFor(() => {
        expect(renderSpy).toHaveBeenCalledTimes(5);
      });

      expect(screen.getByTestId('errors').innerText).toBeUndefined();
    });

    it('should debounce with 200 milliseconds by default', async () => {
      expect.assertions(4);

      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      setup({});
      await waitFor(() => expect(jest.getTimerCount()).toBe(2));

      await act(() => {
        fireEvent.change(screen.getByRole('textbox'), {
          target: { value: 42 }
        });
      });

      await waitFor(() => expect(jest.getTimerCount()).toBe(3));
      jest.runAllTimers();

      await screen.findByText('Value is not 8');

      expect(setTimeoutSpy).toHaveBeenCalled();
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 200);
    });

    it('should accept a custom debounce', async () => {
      expect.assertions(4);

      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      setup({ asyncValidatorsDebounce: 300 });
      await waitFor(() => expect(jest.getTimerCount()).toBe(2));

      await act(() => {
        fireEvent.change(screen.getByRole('textbox'), {
          target: { value: 42 }
        });
      });

      await waitFor(() => expect(jest.getTimerCount()).toBe(3));
      jest.runAllTimers();

      await screen.findByText('Value is not 8');

      expect(setTimeoutSpy).toHaveBeenCalled();
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 300);
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
