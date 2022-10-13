import React, { useState } from 'react';
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

  const [resetTimeout, storeResetTimeout] = useState<() => void>();

  const validate = (
    value: FieldValue,
    // eslint-disable-next-line @typescript-eslint/ban-types
    allValues?: object,
    meta?: FieldState<FieldValue>
  ) =>
    new Promise(async (resolve) => {
      if (resetTimeout) {
        resetTimeout();
      }

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

        // If there are no synchronous errors, perform the asynchronous validation
        if (errors.length > 0) {
          resolve(errors);
          return;
        }
      }

      const asyncValidatorFunctions =
        Array.isArray(asyncValidators) && asyncValidators
          ? [...asyncValidators]
          : [];

      if (asyncValidatorFunctions.length === 0) {
        resolve(undefined);
        return;
      }

      async function asyncValidation() {
        const asyncResults = await Promise.all(
          asyncValidatorFunctions.map((validator) =>
            validator(value, allValues, meta)
          )
        );

        // If there are no errors, return undefined to indicate that everything is a-ok.
        const asyncErrors = asyncResults.filter((v) => v !== undefined);

        resolve(asyncErrors.length === 0 ? undefined : asyncErrors);
      }

      const timeout = setTimeout(asyncValidation, asyncValidatorsDebounce);
      const clearTimeoutCallback = () => {
        clearTimeout(timeout);
        resolve(undefined);
      };
      storeResetTimeout(() => clearTimeoutCallback);
    });

  return <FFField {...fieldProps} validate={validate} />;
}
