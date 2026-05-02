function initMenu() {
  const menuIcon = document.querySelector('.menu_icon');
  const menuDropdown = document.querySelector('.menu_dropdown');

  if (!menuIcon || !menuDropdown) return;

  menuIcon.addEventListener('click', () => {
    menuIcon.classList.toggle('active');
    menuDropdown.classList.toggle('active');
  });
}
document.addEventListener('DOMContentLoaded', initMenu);