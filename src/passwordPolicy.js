// سياسة كلمات المرور الموحدة للنظام.
// ملاحظة: التخزين الآمن يتم في قاعدة البيانات باستخدام bcrypt (cost=8)،
// وليس بتشفير قابل لفكّه.
export const PASSWORD_POLICY_MESSAGE =
  'يجب أن تكون كلمة المرور من 8 إلى 10 أحرف، وتحتوي على حرف إنجليزي كبير وحرف إنجليزي صغير ورقم ورمز.';

export function validatePasswordPolicy(value) {
  const password = String(value ?? '');
  const checks = {
    length: password.length >= 8 && password.length <= 10,
    lower: /[a-z]/.test(password),
    upper: /[A-Z]/.test(password),
    digit: /[0-9]/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };

  return {
    valid: Object.values(checks).every(Boolean),
    checks,
    message: PASSWORD_POLICY_MESSAGE,
  };
}

export function passwordPolicyText(value) {
  const { checks } = validatePasswordPolicy(value);
  return [
    [checks.length, 'الطول من 8 إلى 10 أحرف'],
    [checks.lower, 'حرف إنجليزي صغير'],
    [checks.upper, 'حرف إنجليزي كبير'],
    [checks.digit, 'رقم'],
    [checks.symbol, 'رمز'],
  ];
}

export function generateStrongPassword(length = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const required = [
    'A', 'm', '7', '!',
  ];
  const targetLength = Math.min(10, Math.max(8, Number(length) || 10));
  const cryptoObj = globalThis.crypto;
  const randomIndex = (max) => {
    if (cryptoObj?.getRandomValues) {
      const array = new Uint32Array(1);
      cryptoObj.getRandomValues(array);
      return array[0] % max;
    }
    return Math.floor(Math.random() * max);
  };

  const output = [...required];
  while (output.length < targetLength) {
    output.push(chars[randomIndex(chars.length)]);
  }

  // Fisher-Yates باستخدام مصدر عشوائي مناسب للمتصفح.
  for (let i = output.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1);
    [output[i], output[j]] = [output[j], output[i]];
  }

  return output.join('');
}
