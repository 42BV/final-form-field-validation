import React, { useCallback, useRef } from 'react';
import { FieldState, FieldValidator } from 'final-form';
import {
  Field as FFField,
  FieldProps,
  FieldRenderProps
} from 'react-final-form';

export type Props<FieldValue, T extends HTMLElement> = FieldProps<
  FieldValue,
  FieldRenderProps<FieldValue>,
  T
> & {
  /**
   * An array of custom validators to run whenever the field changes.
   */
  validators?: FieldValidator<FieldValue>[];

  /**
   * An array of custom async validators to run whenever the field changes
   * and the synchronous validators have passed.
   */
  asyncValidators?: FieldValidator<FieldValue>[];

  /**
   * The number of milliseconds to wait before the async validators are ran
   * to prevent validation requests on every keystroke.
   *
   * Defaults to 200 milliseconds.
   *
   * @type {number}
   * @memberof FieldProps
   */
  asyncValidatorsDebounce?: number;
};

/**
 * Field wraps final-form's Field, and adds async validation.
 *
 * It is possible to add custom field validators and async validators
 * via the `validators` and `asyncValidators` props. The `asyncValidators`
 * are only ran when all synchronous `validators` pass.
 */
export function Field<FieldValue, T extends HTMLElement>(
  props: Props<FieldValue, T>
) {
  const {
    validators,
    asyncValidators,
    asyncValidatorsDebounce = 200,
    ...fieldProps
  } = props;

  const debounceResolver = useRef<(value: boolean) => void>(() => undefined);

  const validate = useCallback(
    async (
      value: FieldValue,
      // eslint-disable-next-line @typescript-eslint/ban-types
      allValues?: object,
      meta?: FieldState<FieldValue>
    ) => {
      // Prevent the previous async check from occurring if possible
      debounceResolver.current(false);

      const validatorFunctions =
        Array.isArray(validators) && validators ? [...validators] : [];

      if (validatorFunctions.length > 0) {
        // Perform synchronous validation
        const results = await Promise.all(
          validatorFunctions.map((validator) =>
            validator(value, allValues, meta)
          )
        );

        const errors = results.filter((v) => v !== undefined);

        // If there are no synchronous errors, asynchronous validation will be prepared
        if (errors.length > 0) {
          return errors;
        }
      }

      const asyncValidatorFunctions =
        Array.isArray(asyncValidators) && asyncValidators
          ? [...asyncValidators]
          : [];

      if (asyncValidatorFunctions.length === 0) {
        return undefined;
      }

      const promise = new Promise((resolve) => {
        // Prevent the previous async check from occurring if possible
        debounceResolver.current(false);
        debounceResolver.current = resolve;

        setTimeout(() => resolve(true), asyncValidatorsDebounce);
      });

      const shouldPerformAsyncValidation = await promise;

      if (!shouldPerformAsyncValidation) {
        return undefined;
      }

      const asyncResults = await Promise.all(
        asyncValidatorFunctions.map((validator) =>
          validator(value, allValues, meta)
        )
      );

      const asyncErrors = asyncResults.filter((v) => v !== undefined);

      // If there are no errors, return undefined to indicate that everything is a-ok.
      return asyncErrors.length === 0 ? undefined : asyncErrors;
    },
    [validators, asyncValidators, asyncValidatorsDebounce]
  );

  return <FFField {...fieldProps} validate={validate} />;
}
