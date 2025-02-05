import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { auth } from '../firebase';

type PasswordStrength = 'weak' | 'medium' | 'strong' | null;
type EmailValidity = 'invalid' | 'valid' | null;

interface AuthProps {
  onAuthSuccess?: () => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [email, setEmail] = useState('');
  const [emailValidity, setEmailValidity] = useState<EmailValidity>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [passwordsMatch, setPasswordsMatch] = useState<boolean | null>(null);
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>(null);

  const validateEmail = (email: string): EmailValidity => {
    if (!email) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) ? 'valid' : 'invalid';
  };

  useEffect(() => {
    setEmailValidity(validateEmail(email));
  }, [email]);

  const checkPasswordStrength = (pass: string): PasswordStrength => {
    if (!pass) return null;
    const hasMinLength = pass.length >= 8;
    const hasUpperCase = /[A-Z]/.test(pass);
    const hasLowerCase = /[a-z]/.test(pass);
    const hasNumbers = /\d/.test(pass);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(pass);
    const score = [hasMinLength, hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar]
      .filter(Boolean).length;
    if (score <= 2) return 'weak';
    if (score <= 4) return 'medium';
    return 'strong';
  };

  useEffect(() => {
    if (!isLogin) {
      setPasswordStrength(checkPasswordStrength(password));
      if (password && confirmPassword) {
        setPasswordsMatch(password === confirmPassword);
      } else {
        setPasswordsMatch(null);
      }
    } else {
      setPasswordStrength(null);
      setPasswordsMatch(null);
    }
  }, [password, confirmPassword, isLogin]);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (emailValidity !== 'valid') {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    if (!isLogin) {
      if (password !== confirmPassword) {
        Alert.alert('Error', 'Passwords do not match');
        return;
      }
      if (passwordStrength !== 'strong') {
        Alert.alert('Error', 'Password is not strong enough');
        return;
      }
    }
    try {
      setLoading(true);
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      onAuthSuccess?.();
    } catch (error: any) {
      console.error('Auth error:', error);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setPassword('');
    setConfirmPassword('');
    setPasswordsMatch(null);
    setPasswordStrength(null);
  };

  const getEmailInputStyle = () => {
    return [
      styles.input,
      email ? (
        emailValidity === 'valid' ? styles.inputSuccess :
        styles.inputError
      ) : null
    ];
  };

  const getPasswordInputStyle = (isConfirm = false) => {
    if (isLogin) return styles.input;
    
    // For the password input field
    if (!isConfirm) {
      return [
        styles.input,
        password ? (
          passwordStrength === 'strong' ? styles.inputSuccess :
          passwordStrength === 'medium' ? styles.inputMedium :
          styles.inputError
        ) : null
      ];
    }
    
    // For the confirm password input field
    return [
      styles.input,
      password && confirmPassword ? (
        passwordsMatch && passwordStrength === 'strong' ? styles.inputSuccess : styles.inputError
      ) : null
    ];
  };

  const getPasswordStrengthMessage = () => {
    if (!password) return '';
    switch (passwordStrength) {
      case 'weak':
        return 'Weak password - Use 8+ chars, upper/lowercase, numbers & symbols';
      case 'medium':
        return 'Medium strength - Add more character types for a stronger password';
      case 'strong':
        return 'Strong password!';
      default:
        return '';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.header}>{isLogin ? 'Login' : 'Sign Up'}</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={getEmailInputStyle()}
            placeholder="Email"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading}
          />
          {email ? (
            <Text style={[
              styles.matchStatus,
              emailValidity === 'valid' ? styles.matchStatusSuccess : styles.matchStatusError
            ]}>
              {emailValidity === 'valid' ? 'Valid email address' : 'Invalid email address'}
            </Text>
          ) : null}
        </View>
        <View style={styles.passwordContainer}>
          <TextInput
            style={getPasswordInputStyle()}
            placeholder="Password"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
          />
          {!isLogin && password ? (
            <Text style={[
              styles.matchStatus,
              passwordStrength === 'strong' ? styles.matchStatusSuccess :
              passwordStrength === 'medium' ? styles.matchStatusMedium :
              styles.matchStatusError
            ]}>
              {getPasswordStrengthMessage()}
            </Text>
          ) : null}
        </View>
        {!isLogin ? (
          <View style={styles.passwordContainer}>
            <TextInput
              style={getPasswordInputStyle(true)}
              placeholder="Confirm Password"
              placeholderTextColor="#999"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              editable={!loading}
            />
            {password && confirmPassword ? (
              <Text style={[
                styles.matchStatus,
                passwordsMatch && passwordStrength === 'strong' ? styles.matchStatusSuccess : styles.matchStatusError
              ]}>
                {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
              </Text>
            ) : null}
          </View>
        ) : null}
        <TouchableOpacity
          style={[
            styles.button,
            loading && styles.buttonDisabled,
            !isLogin && (!passwordsMatch || passwordStrength !== 'strong' || emailValidity !== 'valid') && 
              (password || confirmPassword || email) && styles.buttonError
          ]}
          onPress={handleAuth}
          disabled={loading || (!isLogin && (!passwordsMatch || passwordStrength !== 'strong' || emailValidity !== 'valid') && 
            (password || confirmPassword || email))}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Please wait...' : isLogin ? 'Login' : 'Sign Up'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.switchButton}
          onPress={toggleMode}
          disabled={loading}
        >
          <Text style={styles.switchButtonText}>
            {isLogin ? 'Need an account? Sign Up' : 'Have an account? Login'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  inputContainer: {
    marginBottom: 16,
  },
  passwordContainer: {
    marginBottom: 16,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 32,
    textAlign: 'center',
  },
  input: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  inputSuccess: {
    borderColor: '#34C759',
    backgroundColor: '#E8F5E9',
  },
  inputMedium: {
    borderColor: '#FF9500',
    backgroundColor: '#FFF3E0',
  },
  inputError: {
    borderColor: '#FF3B30',
    backgroundColor: '#FFEBEE',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonError: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  switchButton: {
    padding: 8,
  },
  switchButtonText: {
    color: '#007AFF',
    fontSize: 14,
    textAlign: 'center',
  },
  matchStatus: {
    textAlign: 'center',
    marginTop: 4,
    fontSize: 14,
  },
  matchStatusSuccess: {
    color: '#34C759',
  },
  matchStatusMedium: {
    color: '#FF9500',
  },
  matchStatusError: {
    color: '#FF3B30',
  },
}); 