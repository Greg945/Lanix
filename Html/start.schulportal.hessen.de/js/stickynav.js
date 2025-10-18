var b;

$().ready(function() {

   var stickyToggle = function(sticky, stickyWrapper, scrollElement) {
    var stickyHeight = sticky.outerHeight();
    var stickyTop = stickyWrapper.offset().top;
    if (scrollElement.scrollTop() >= stickyTop){
      stickyWrapper.height(stickyHeight);
      sticky.addClass("is-sticky");
    }
    else{
      sticky.removeClass("is-sticky");
      stickyWrapper.height('auto');
    }
  };
  
  // Find all data-toggle="sticky-onscroll" elements
  $('[data-toggle="sticky-onscroll"]').each(function() {
    var sticky = $(this);
    var stickyWrapper = $('<div>').addClass('sticky-wrapper'); // insert hidden element to maintain actual top offset on page
    sticky.before(stickyWrapper);
    sticky.addClass('sticky');
    
    // Scroll & resize events
    $(window).on('scroll.sticky-onscroll resize.sticky-onscroll', function() {
      stickyToggle(sticky, stickyWrapper, $(this));
    });
    
    // On page load
    stickyToggle(sticky, stickyWrapper, $(window));
  });
  
  /*

    //Sticky Navbar
    var navbarTop = $('.navbar').css('margin-bottom', 0).position().top;

    if(navbarTop>10) {
	    $(document).scroll(function(e){
	        var scrollTop = $(document).scrollTop();
	        if(scrollTop > navbarTop){
	            $('body').css('margin-top', $('.navbar').height());
	            $('.navbar').removeClass('navbar-static-top').addClass('navbar-fixed-top');
	        } else {
	            $('body').css('margin-top', 0);
	            $('.navbar').removeClass('navbar-fixed-top').addClass('navbar-static-top');
	        }
	    });
    }
    else {
    	$('body').css('margin-top', $('.navbar').height());
    	$('.navbar').removeClass('navbar-static-top').addClass('navbar-fixed-top');
    }*/
});