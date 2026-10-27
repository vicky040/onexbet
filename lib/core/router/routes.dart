abstract final class Routes {
  static const splash = '/splash';
  static const login = '/login';
  static const signup = '/signup';
  static const forgotPassword = '/forgot-password';

  static const home = '/home';
  static const accounts = '/accounts';
  static const addBank = '/accounts/add';
  static String editBank(String id) => '/accounts/$id/edit';
  static const payin = '/payin';
  static const payout = '/payout';
  static const myPayments = '/payout/my-payments';
  static const history = '/history';

  static const deposit = '/deposit';
  static const notifications = '/notifications';
  static const profile = '/profile';
  static const support = '/support';
  static const earnings = '/earnings';

  static const authRoutes = {login, signup, forgotPassword};
}
