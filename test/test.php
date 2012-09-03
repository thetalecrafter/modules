<?php require_once '../modules.php'; ?>
<!DOCTYPE html>
<html>
<head>
	<title>modules.php test</title>
	<style>
		html, body { margin:0; padding:0; }
		.report { background:blue; color:white; padding:5px; text-indent:5px; cursor:pointer; outline:none; }
		.pass { background:green; }
		.fail { background:red; }
		.report ol { display:none; }
		.report:focus ol { display:block; }
	</style>
</head>
<body>
	<div class="report">modules.php tests</div>
	<script id="require-script" src="/modules/modules.php/require"></script>
	<?php Modules::script('test'); ?>
	<script>require('test')</script>
</body>
</html>
