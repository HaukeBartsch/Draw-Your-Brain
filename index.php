<!doctype html>
<html lang="en">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Draw your brain</title>
        <link rel="stylesheet" href="css/bootstrap.min.css" />
        <link rel="stylesheet" href="css/styles.css?_=1238" />
    </head>
    <body>
        <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
            <div class="container">
                <a class="navbar-brand" href="#">Draw Your Brain - MMIV</a>
                <button
                    class="navbar-toggler"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target="#navbarSupportedContent"
                    aria-controls="navbarSupportedContent"
                    aria-expanded="false"
                    aria-label="Toggle navigation"
                >
                    <span class="navbar-toggler-icon"></span>
                </button>
                <div
                    class="collapse navbar-collapse"
                    id="navbarSupportedContent"
                >
                <div class="row">
                  <ul class="navbar-nav me-auto mb-2 mb-lg-0 col-md">
                    <li>
                        <p class="text-white">Learn more about the <a style="color: white;" href="https://mmiv.no/">Mohn Medical Imaging and Visualization Centre (MMIV)</a>, a collaboration between the University of Bergen and the Haukeland University Hospital.</p>
                    </li>
                  </ul>
                  <ul class="navbar-nav me-auto mb-2 mb-lg-0 col-md">
                    <li>
                    <p class="text-white" style="text-align: right;">
                           <image src="images/QR.png" width="100px" height="auto">
                    </p>
                    </li>
                  </ul>   
</div>
                </div>
            </div>
        </nav>

	<svg xmlns="http://www.w3.org/2000/svg" class="d-none">
	  <symbol id="pencil" width="16" height="16" fill="currentColor" class="bi bi-pencil" viewBox="0 0 16 16">
	    <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325"/>
	  </symbol>
	</svg>
	
        <svg xmlns="http://www.w3.org/2000/svg" class="d-none">
            <symbol id="geo-fill" viewBox="0 0 16 16">
                <path
                    fill-rule="evenodd"
                    d="M4 4a4 4 0 1 1 4.5 3.969V13.5a.5.5 0 0 1-1 0V7.97A4 4 0 0 1 4 3.999zm2.493 8.574a.5.5 0 0 1-.411.575c-.712.118-1.28.295-1.655.493a1.319 1.319 0 0 0-.37.265.301.301 0 0 0-.057.09V14l.002.008a.147.147 0 0 0 .016.033.617.617 0 0 0 .145.15c.165.13.435.27.813.395.751.25 1.82.414 3.024.414s2.273-.163 3.024-.414c.378-.126.648-.265.813-.395a.619.619 0 0 0 .146-.15.148.148 0 0 0 .015-.033L12 14v-.004a.301.301 0 0 0-.057-.09 1.318 1.318 0 0 0-.37-.264c-.376-.198-.943-.375-1.655-.493a.5.5 0 1 1 .164-.986c.77.127 1.452.328 1.957.594C12.5 13 13 13.4 13 14c0 .426-.26.752-.544.977-.29.228-.68.413-1.116.558-.878.293-2.059.465-3.34.465-1.281 0-2.462-.172-3.34-.465-.436-.145-.826-.33-1.116-.558C3.26 14.752 3 14.426 3 14c0-.599.5-1 .961-1.243.505-.266 1.187-.467 1.957-.594a.5.5 0 0 1 .575.411z"
                ></path>
            </symbol>
        </svg>

        <div class="container my-4">
            <div class="feature col">
                <div
                    class="card card-cover h-100 overflow-hidden text-bg-dark rounded-4"
                    style="
                        background-image: url(&quot;images/background.png&quot;);
                        background-size: cover;
                        background-position: center;
                    "
                >
                    <div
                        class="d-flex flex-column h-100 p-5 pb-3 text-white text-shadow-1"
                    >
                     <!--   <h3 class="pt-5 mt-5 mb-4 display-6 lh-1 fw-bold">
                            Draw your brain
                        </h3> -->
                        <ul class="d-flex list-unstyled mt-auto">
                            <li class="me-auto">
                                <button
                                    onclick="location.href='drawBrain.html';"
                                    class="btn btn-primary"
                                >
                                <svg class="bi me-2" width="1em" height="1em">
                                    <use xlink:href="#pencil"></use>
                                </svg>
                                    <span en="Draw your own brain" no="Tegne din egen hjerne"></span>
                                </button>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            <h2 class="pb-2 border-bottom" style="margin-top: 40px">
                <span en="Shared drawings" no="Delte tegninger"></span>
            </h2>
            <div class="n-items-stretch g-4 py-2">
                <div class="gallery"></div>
            </div>

            <div class="modal fade" tabindex="-1" id="details">
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                Drawing #<span id="num_drawing">0</span>
                            </h5>
                            <button
                                type="button"
                                class="btn-close"
                                data-bs-dismiss="modal"
                                aria-label="Close"
                            ></button>
                        </div>
                        <div class="modal-body">
                            <div
                                class="detailed_parent mx-auto"
                                id="detailed_canvas"
                            >
                                <canvas
                                    style="width: 100%; height: 100%"
                                ></canvas>
                            </div>
                        </div>
                        <div class="modal-footer">
<?php if (isset($_GET["admin"])): ?>
                            <button
                                type="button"
                                class="btn btn-danger"
                              data-bs-dismiss="modal"
			      id="delete-button"
                            >
                                Delete
                            </button>
<?php endif; ?>			  
                            <button
                                type="button"
                                class="btn btn-primary"
                                data-bs-dismiss="modal"
                            >
                            <span en="Close" no="Lukke">Close</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <script src="js/bootstrap.bundle.min.js"></script>
        <script src="js/jquery-3.7.1.min.js"></script>
        <script src="js/gallery.js?_=12368"></script>
    </body>
</html>
