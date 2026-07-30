import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { setToken } from '../lib/auth';

const LoginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Required'),
});
type LoginForm = z.infer<typeof LoginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(LoginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      const res = await api.post<{ accessToken: string; player: { isAdmin: boolean } }>(
        '/auth/login',
        data,
      );
      if (!res.player.isAdmin) {
        toast.error('Access denied — admin only');
        return;
      }
      setToken(res.accessToken);
      navigate('/players');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-white p-8 rounded-lg shadow w-80 space-y-4"
      >
        <h1 className="text-xl font-bold">TinyTower Admin</h1>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            {...register('email')}
            type="email"
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            {...register('password')}
            type="password"
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}
